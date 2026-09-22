import { createReadStream } from "node:fs";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readdir, rename, stat, unlink, writeFile, readFile } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import ffmpegStatic from "ffmpeg-static";
import convert from "heic-convert";
import { contentTypeFor, getMediaDir } from "@/lib/media";
import { isQuickTimeName, parseQuickTimeMeta } from "@/lib/quicktime-meta";

export type PlayableMedia = {
  filePath: string;
  contentType: string;
  size: number;
};

const FFMPEG_TIMEOUT_MS = 180_000;
const inflight = new Map<string, Promise<PlayableMedia>>();
let ffmpegQueue: Promise<unknown> = Promise.resolve();

function enqueueFfmpeg<T>(task: () => Promise<T>): Promise<T> {
  const run = ffmpegQueue.then(task, task);
  ffmpegQueue = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

function cacheDir(): string {
  return path.join(getMediaDir(), ".cache");
}

function cachePath(name: string, mtimeMs: number, suffix: string): string {
  const id = createHash("sha1").update(name).digest("hex").slice(0, 12);
  return path.join(cacheDir(), `${mtimeMs}-${id}${suffix}`);
}

function isHeicName(name: string): boolean {
  const ext = path.extname(name).toLowerCase();
  return ext === ".heic" || ext === ".heif";
}

async function cachedIfFresh(filePath: string): Promise<PlayableMedia | null> {
  try {
    const fileStat = await stat(filePath);
    if (!fileStat.isFile() || fileStat.size < 32) {
      return null;
    }
    return {
      filePath,
      contentType: contentTypeFor(filePath),
      size: fileStat.size,
    };
  } catch {
    return null;
  }
}

async function convertHeic(
  filePath: string,
  outputPath: string,
): Promise<void> {
  const input = await readFile(filePath);
  const jpeg = await convert({
    buffer: input,
    format: "JPEG",
    quality: 0.86,
  });
  const tmp = `${outputPath}.tmp`;
  await writeFile(tmp, Buffer.from(jpeg));
  await rename(tmp, outputPath);
}

function ffmpegBin(): string {
  if (typeof ffmpegStatic === "string" && ffmpegStatic.length > 0) {
    return ffmpegStatic;
  }
  return "ffmpeg";
}

function runFfmpeg(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(/* turbopackIgnore: true */ ffmpegBin(), args, {
      stdio: ["ignore", "ignore", "pipe"],
    });
    let stderr = "";
    child.stderr?.on("data", (chunk: Buffer) => {
      stderr += chunk.toString("utf8");
      if (stderr.length > 4000) {
        stderr = stderr.slice(-4000);
      }
    });
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error("ffmpeg timed out"));
    }, FFMPEG_TIMEOUT_MS);
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`ffmpeg exited ${code}: ${stderr.trim()}`));
    });
  });
}

async function transcodeVideo(
  filePath: string,
  outputPath: string,
): Promise<void> {
  const tmp = `${outputPath}.tmp.mp4`;
  await runFfmpeg([
    "-y",
    "-i",
    filePath,
    "-c:v",
    "libx264",
    "-preset",
    "ultrafast",
    "-crf",
    "23",
    "-pix_fmt",
    "yuv420p",
    "-c:a",
    "aac",
    "-ac",
    "2",
    "-movflags",
    "+faststart",
    tmp,
  ]);
  await rename(tmp, outputPath);
}

async function buildPlayable(
  filePath: string,
  name: string,
): Promise<PlayableMedia> {
  const fileStat = await stat(filePath);
  await mkdir(cacheDir(), { recursive: true });

  if (isHeicName(name)) {
    const outputPath = cachePath(name, fileStat.mtimeMs, ".jpg");
    const cached = await cachedIfFresh(outputPath);
    if (cached) {
      return { ...cached, contentType: "image/jpeg" };
    }
    await convertHeic(filePath, outputPath);
    const converted = await stat(outputPath);
    return {
      filePath: outputPath,
      contentType: "image/jpeg",
      size: converted.size,
    };
  }

  if (isQuickTimeName(name)) {
    let hevc = path.extname(name).toLowerCase() === ".mov";
    try {
      hevc = (await parseQuickTimeMeta(filePath)).hevc;
    } catch {
      hevc = true;
    }

    if (hevc) {
      const outputPath = cachePath(name, fileStat.mtimeMs, ".mp4");
      const cached = await cachedIfFresh(outputPath);
      if (cached) {
        return { ...cached, contentType: "video/mp4" };
      }
      await enqueueFfmpeg(() => transcodeVideo(filePath, outputPath));
      const converted = await stat(outputPath);
      return {
        filePath: outputPath,
        contentType: "video/mp4",
        size: converted.size,
      };
    }
  }

  return {
    filePath,
    contentType: contentTypeFor(name),
    size: fileStat.size,
  };
}

export async function playableMedia(
  filePath: string,
  name: string,
): Promise<PlayableMedia> {
  const existing = inflight.get(filePath);
  if (existing) {
    return existing;
  }

  const work = buildPlayable(filePath, name).finally(() => {
    inflight.delete(filePath);
  });
  inflight.set(filePath, work);
  return work;
}

export function warmupPlayable(filePath: string, name: string): void {
  if (!isHeicName(name) && !isQuickTimeName(name)) {
    return;
  }
  void playableMedia(filePath, name).catch(() => undefined);
}

export async function pruneDerivedCache(names: string[]): Promise<void> {
  const dir = cacheDir();
  let entries: string[];
  try {
    entries = await readdir(dir);
  } catch {
    return;
  }

  const keep = new Set<string>();
  await Promise.all(
    names.map(async (name) => {
      const filePath = path.join(getMediaDir(), name);
      try {
        const fileStat = await stat(filePath);
        if (isHeicName(name)) {
          keep.add(path.basename(cachePath(name, fileStat.mtimeMs, ".jpg")));
        }
        if (isQuickTimeName(name)) {
          keep.add(path.basename(cachePath(name, fileStat.mtimeMs, ".mp4")));
        }
      } catch {
        return;
      }
    }),
  );

  await Promise.all(
    entries.map(async (entry) => {
      if (entry.startsWith(".") || entry.includes(".tmp")) {
        return;
      }
      if (keep.has(entry)) {
        return;
      }
      await unlink(path.join(dir, entry)).catch(() => undefined);
    }),
  );
}

export function fileStream(
  filePath: string,
  start: number,
  end: number,
): ReadableStream<Uint8Array> {
  const nodeStream = createReadStream(/* turbopackIgnore: true */ filePath, {
    start,
    end,
  });
  return Readable.toWeb(nodeStream) as ReadableStream<Uint8Array>;
}
