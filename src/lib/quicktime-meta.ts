import { open, type FileHandle } from "node:fs/promises";

const MAC_EPOCH_MS = Date.UTC(1904, 0, 1);
const MAX_MOOV_BYTES = 4_000_000;
const NESTED_BOXES = new Set([
  "moov",
  "trak",
  "mdia",
  "minf",
  "stbl",
  "udta",
  "meta",
  "ilst",
  "edts",
]);

export type QuickTimeGps = {
  latitude: number;
  longitude: number;
};

export type QuickTimeMeta = {
  gps: QuickTimeGps | null;
  hevc: boolean;
  year: number | null;
  month: number | null;
  day: number | null;
};

type Box = {
  offset: number;
  size: number;
  type: string;
  header: number;
};

async function readBox(
  fh: FileHandle,
  offset: number,
  fileSize: number,
): Promise<Box | null> {
  if (offset + 8 > fileSize) {
    return null;
  }

  const head = Buffer.alloc(16);
  const first = await fh.read({ buffer: head.subarray(0, 8), position: offset });
  if (first.bytesRead < 8) {
    return null;
  }

  let size = head.readUInt32BE(0);
  const type = head.toString("latin1", 4, 8);
  let header = 8;

  if (size === 1) {
    if (offset + 16 > fileSize) {
      return null;
    }
    const second = await fh.read({
      buffer: head.subarray(8, 16),
      position: offset + 8,
    });
    if (second.bytesRead < 8) {
      return null;
    }
    const big = head.readBigUInt64BE(8);
    if (big > BigInt(Number.MAX_SAFE_INTEGER)) {
      return null;
    }
    size = Number(big);
    header = 16;
  } else if (size === 0) {
    size = fileSize - offset;
  }

  if (size < header || offset + size > fileSize) {
    return null;
  }

  return { offset, size, type, header };
}

async function findMoov(
  fh: FileHandle,
  fileSize: number,
): Promise<Box | null> {
  let offset = 0;
  while (offset < fileSize) {
    const box = await readBox(fh, offset, fileSize);
    if (!box) {
      return null;
    }
    if (box.type === "moov") {
      return box;
    }
    offset += box.size;
  }
  return null;
}

function walkBuffer(
  buf: Buffer,
  start: number,
  end: number,
  visit: (box: Box) => void,
) {
  let offset = start;
  while (offset + 8 <= end) {
    let size = buf.readUInt32BE(offset);
    const type = buf.toString("latin1", offset + 4, offset + 8);
    let header = 8;
    if (size === 1) {
      if (offset + 16 > end) {
        break;
      }
      size = Number(buf.readBigUInt64BE(offset + 8));
      header = 16;
    } else if (size === 0) {
      size = end - offset;
    }
    if (size < header || offset + size > end) {
      break;
    }

    const box = { offset, size, type, header };
    visit(box);

    if (NESTED_BOXES.has(type)) {
      const innerStart = offset + header + (type === "meta" ? 4 : 0);
      walkBuffer(buf, innerStart, offset + size, visit);
    }

    offset += size;
  }
}

function parseIso6709(value: string): QuickTimeGps | null {
  const match = value
    .trim()
    .match(
      /^([+-])(\d{2,3}(?:\.\d+)?)([+-])(\d{3}(?:\.\d+)?)(?:[+-]\d+(?:\.\d+)?)?\/?$/,
    );
  if (!match) {
    return null;
  }

  const latitude = Number(match[1] + match[2]);
  const longitude = Number(match[3] + match[4]);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return null;
  }

  return { latitude, longitude };
}

function parseCreationDate(text: string): {
  year: number;
  month: number;
  day: number;
} | null {
  const match = text.match(/(20\d{2}|19\d{2})-(\d{2})-(\d{2})T\d{2}:\d{2}:\d{2}/);
  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) {
    return null;
  }

  return { year, month, day };
}

function dateFromMvhd(buf: Buffer, box: Box): {
  year: number;
  month: number;
  day: number;
} | null {
  const bodyStart = box.offset + box.header;
  if (bodyStart + 12 > buf.length) {
    return null;
  }

  const version = buf[bodyStart];
  let created: number;
  try {
    created =
      version === 1
        ? Number(buf.readBigUInt64BE(bodyStart + 4))
        : buf.readUInt32BE(bodyStart + 4);
  } catch {
    return null;
  }

  const date = new Date(MAC_EPOCH_MS + created * 1000);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
  };
}

export async function parseQuickTimeMeta(
  filePath: string,
): Promise<QuickTimeMeta> {
  const empty: QuickTimeMeta = {
    gps: null,
    hevc: false,
    year: null,
    month: null,
    day: null,
  };
  const fh = await open(filePath, "r");

  try {
    const stat = await fh.stat();
    const moov = await findMoov(fh, stat.size);
    if (!moov || moov.size > MAX_MOOV_BYTES) {
      return empty;
    }

    const buf = Buffer.alloc(moov.size);
    const { bytesRead } = await fh.read({
      buffer: buf,
      position: moov.offset,
    });
    if (bytesRead < 8) {
      return empty;
    }

    const text = buf.toString("latin1");
    const isoMatch = text.match(
      /[+-]\d{2,3}\.\d+[+-]\d{3}\.\d+(?:[+-]\d+\.\d+)?\//,
    );
    const gps = isoMatch ? parseIso6709(isoMatch[0]) : null;
    const fromApple = parseCreationDate(text);

    let fromMvhd: { year: number; month: number; day: number } | null = null;
    if (!fromApple) {
      walkBuffer(buf, 0, bytesRead, (box) => {
        if (!fromMvhd && box.type === "mvhd") {
          fromMvhd = dateFromMvhd(buf, box);
        }
      });
    }

    const hevc =
      buf.includes(Buffer.from("hvc1")) || buf.includes(Buffer.from("hev1"));
    const taken = fromApple ?? fromMvhd;
    return {
      gps,
      hevc,
      year: taken?.year ?? null,
      month: taken?.month ?? null,
      day: taken?.day ?? null,
    };
  } finally {
    await fh.close();
  }
}

export function isQuickTimeName(name: string): boolean {
  const dot = name.lastIndexOf(".");
  const ext = dot === -1 ? "" : name.slice(dot).toLowerCase();
  return ext === ".mov" || ext === ".mp4" || ext === ".m4v";
}
