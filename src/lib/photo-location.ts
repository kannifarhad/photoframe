import { stat } from "node:fs/promises";
import exifr from "exifr";
import { isQuickTimeName, parseQuickTimeMeta } from "./quicktime-meta";

export type PhotoMeta = {
  location: string | null;
  takenAt: string | null;
};

type FileCacheEntry = {
  mtimeMs: number;
} & PhotoMeta;

const fileCache = new Map<string, FileCacheEntry>();
const geoCache = new Map<string, string | null>();
const geoInflight = new Map<string, Promise<string | null>>();
let geoQueue: Promise<unknown> = Promise.resolve();

function enqueueGeo<T>(task: () => Promise<T>): Promise<T> {
  const run = geoQueue.then(task, task);
  geoQueue = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

function isValidGps(latitude: number, longitude: number): boolean {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return false;
  }
  if (latitude === 0 && longitude === 0) {
    return false;
  }
  return Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180;
}

function geoKey(latitude: number, longitude: number): string {
  return `${latitude.toFixed(3)},${longitude.toFixed(3)}`;
}

function tidyPlace(value: string): string {
  return value
    .replace(
      /^(Municipality of |Municipal Unit of |Region of |District of )/i,
      "",
    )
    .replace(
      / (Municipal Unit|Regional Unit|Raion|Rayon|District)$/i,
      "",
    )
    .trim();
}

function formatAddress(
  address: Record<string, string | undefined>,
): string | null {
  const cityRaw =
    address.city ||
    address.town ||
    address.village ||
    address.municipality ||
    address.city_district ||
    address.county;
  const city = cityRaw ? tidyPlace(cityRaw) : "";
  const country = address.country?.trim() ?? "";

  if (city && country && city.toLowerCase() !== country.toLowerCase()) {
    return `${city}, ${country}`;
  }

  return city || country || null;
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = [
  "Jan.",
  "Feb.",
  "Mar.",
  "Apr.",
  "May",
  "Jun.",
  "Jul.",
  "Aug.",
  "Sept.",
  "Oct.",
  "Nov.",
  "Dec.",
];

function parseOffsetMinutes(offset: unknown): number | null {
  if (typeof offset !== "string") {
    return null;
  }

  const match = offset.trim().match(/^([+-])(\d{2}):(\d{2})$/);
  if (!match) {
    return null;
  }

  const sign = match[1] === "-" ? -1 : 1;
  return sign * (Number(match[2]) * 60 + Number(match[3]));
}

function wallParts(
  date: Date,
  offsetMinutes: number | null,
): { year: number; month: number; day: number } {
  if (offsetMinutes === null) {
    return {
      year: date.getFullYear(),
      month: date.getMonth(),
      day: date.getDate(),
    };
  }

  const shifted = new Date(date.getTime() + offsetMinutes * 60_000);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth(),
    day: shifted.getUTCDate(),
  };
}

function formatCaptionDate(
  year: number,
  month: number,
  day: number,
): string | null {
  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    !Number.isInteger(day)
  ) {
    return null;
  }

  const utc = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  if (
    utc.getUTCFullYear() !== year ||
    utc.getUTCMonth() !== month - 1 ||
    utc.getUTCDate() !== day
  ) {
    return null;
  }

  const weekday = WEEKDAYS[utc.getUTCDay()];
  const monthName = MONTHS[month - 1];
  if (!weekday || !monthName) {
    return null;
  }

  return `${weekday}, ${monthName} ${day}, ${year}`;
}

function parseDateToken(value: string): string | null {
  const match = value.trim().match(/^(\d{4})[-_.](\d{2})[-_.](\d{2})$/);
  if (!match) {
    return null;
  }

  return formatCaptionDate(Number(match[1]), Number(match[2]), Number(match[3]));
}

export function parseFilenameOverride(filename: string): PhotoMeta {
  const base = filename.replace(/\.[^.]+$/, "");
  const blocks = [...base.matchAll(/\[([^[\]]+)\]/g)].map((match) =>
    match[1].trim(),
  );

  let location: string | null = null;
  let takenAt: string | null = null;

  for (const block of blocks) {
    const parts = block
      .split("|")
      .map((part) => part.trim())
      .filter(Boolean);

    for (const part of parts) {
      const dated = parseDateToken(part);
      if (dated) {
        takenAt = dated;
        continue;
      }

      const place = part.replace(/\s+/g, " ").trim();
      if (place) {
        location = place;
      }
    }
  }

  return { location, takenAt };
}

function takenAtFromMeta(
  meta: Record<string, unknown> | undefined,
): string | null {
  if (!meta) {
    return null;
  }

  const raw =
    meta.DateTimeOriginal instanceof Date
      ? meta.DateTimeOriginal
      : meta.CreateDate instanceof Date
        ? meta.CreateDate
        : null;

  if (!raw || Number.isNaN(raw.getTime())) {
    return null;
  }

  const offsetMinutes =
    parseOffsetMinutes(meta.OffsetTimeOriginal) ??
    parseOffsetMinutes(meta.OffsetTime);
  const parts = wallParts(raw, offsetMinutes);
  return formatCaptionDate(parts.year, parts.month + 1, parts.day);
}

function locationFromTags(meta: Record<string, unknown> | undefined): string | null {
  if (!meta) {
    return null;
  }

  const city = [meta.City, meta.CityCreated, meta.LocationCreatedCity].find(
    (value) => typeof value === "string" && value.trim(),
  ) as string | undefined;
  const country = [
    meta.Country,
    meta.CountryPrimaryLocationName,
    meta.LocationCreatedCountryName,
  ].find((value) => typeof value === "string" && value.trim()) as
    | string
    | undefined;

  if (city && country) {
    return `${city.trim()}, ${country.trim()}`;
  }

  return city?.trim() || country?.trim() || null;
}

async function reverseGeocode(
  latitude: number,
  longitude: number,
): Promise<string | null> {
  const key = geoKey(latitude, longitude);
  if (geoCache.has(key)) {
    return geoCache.get(key) ?? null;
  }

  const inflight = geoInflight.get(key);
  if (inflight) {
    return inflight;
  }

  const request = enqueueGeo(async () => {
    if (geoCache.has(key)) {
      return geoCache.get(key) ?? null;
    }

    const url = new URL("https://nominatim.openstreetmap.org/reverse");
    url.searchParams.set("lat", String(latitude));
    url.searchParams.set("lon", String(longitude));
    url.searchParams.set("format", "json");
    url.searchParams.set("zoom", "12");
    url.searchParams.set("accept-language", "en");

    try {
      const response = await fetch(url, {
        cache: "no-store",
        headers: {
          "User-Agent": "smart-dashboard/1.0 (photoframe kiosk)",
        },
      });
      if (!response.ok) {
        geoCache.set(key, null);
        return null;
      }

      const data = (await response.json()) as {
        address?: Record<string, string | undefined>;
      };
      const name = data.address ? formatAddress(data.address) : null;
      geoCache.set(key, name);
      return name;
    } catch {
      return null;
    }
  });

  geoInflight.set(key, request);
  try {
    return await request;
  } finally {
    geoInflight.delete(key);
  }
}

async function metadataForPath(
  filePath: string,
  name: string,
  mtimeMs: number,
): Promise<PhotoMeta> {
  const cached = fileCache.get(name);
  if (cached && cached.mtimeMs === mtimeMs && cached.takenAt !== undefined) {
    return { location: cached.location, takenAt: cached.takenAt };
  }

  const override = parseFilenameOverride(name);
  let location: string | null = null;
  let takenAt: string | null = null;

  try {
    if (isQuickTimeName(name)) {
      const quicktime = await parseQuickTimeMeta(filePath);
      if (quicktime.year && quicktime.month && quicktime.day) {
        takenAt = formatCaptionDate(
          quicktime.year,
          quicktime.month,
          quicktime.day,
        );
      }
      if (
        !override.location &&
        quicktime.gps &&
        isValidGps(quicktime.gps.latitude, quicktime.gps.longitude)
      ) {
        location = await reverseGeocode(
          quicktime.gps.latitude,
          quicktime.gps.longitude,
        );
      }
    } else {
      const meta = (await exifr.parse(filePath, {
        gps: true,
        iptc: true,
        xmp: true,
        exif: true,
      })) as Record<string, unknown> | undefined;

      location = locationFromTags(meta);
      takenAt = takenAtFromMeta(meta);

      const latitude =
        typeof meta?.latitude === "number" ? meta.latitude : undefined;
      const longitude =
        typeof meta?.longitude === "number" ? meta.longitude : undefined;

      if (
        !override.location &&
        !location &&
        latitude !== undefined &&
        longitude !== undefined &&
        isValidGps(latitude, longitude)
      ) {
        location = await reverseGeocode(latitude, longitude);
      }
    }
  } catch {
    location = location ?? null;
  }

  const resolved = {
    location: override.location ?? location,
    takenAt: override.takenAt ?? takenAt,
  };
  fileCache.set(name, { mtimeMs, ...resolved });
  return resolved;
}

export async function metadataForMediaFile(
  filePath: string,
  name: string,
): Promise<PhotoMeta> {
  try {
    const fileStat = await stat(filePath);
    return metadataForPath(filePath, name, fileStat.mtimeMs);
  } catch {
    return { location: null, takenAt: null };
  }
}
