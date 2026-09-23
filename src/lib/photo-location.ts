import { readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import exifr from "exifr";
import { getMediaDir } from "./media";
import { isQuickTimeName, parseQuickTimeMeta } from "./quicktime-meta";

export type PhotoMeta = {
  location: string | null;
  takenAt: string | null;
};

type GeoResult =
  | { status: "ok"; name: string | null }
  | { status: "error" };

const geoCache = new Map<string, string | null>();
const geoInflight = new Map<string, Promise<GeoResult>>();
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

function isoDate(year: number, month: number, day: number): string | null {
  if (!formatCaptionDate(year, month, day)) {
    return null;
  }

  const monthText = String(month).padStart(2, "0");
  const dayText = String(day).padStart(2, "0");
  return `${year}-${monthText}-${dayText}`;
}

export function captionDate(stored: string | null): string | null {
  if (!stored) {
    return null;
  }

  const match = stored.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) {
    return stored;
  }

  return (
    formatCaptionDate(Number(match[1]), Number(match[2]), Number(match[3])) ??
    stored
  );
}

const DATE_IN_TEXT = /(\d{4})[-_.](\d{2})[-_.](\d{2})/;
const VERTICAL_BARS = /[|¦ǀ∣│┃｜]/g;

function placeFromBlock(block: string, dateText: string | null): string | null {
  let place = dateText ? block.replace(dateText, " ") : block;
  place = place
    .replace(VERTICAL_BARS, " ")
    .replace(/\s+/g, " ")
    .replace(/^[,.\-–—\s]+|[,.\-–—\s]+$/g, "")
    .trim();
  return place || null;
}

export function parseFilenameOverride(filename: string): PhotoMeta {
  const base = filename.replace(/\.[^.]+$/, "");
  const blocks = [...base.matchAll(/\[([^[\]]+)\]/g)].map((match) =>
    match[1].trim(),
  );

  let location: string | null = null;
  let takenAt: string | null = null;

  for (const block of blocks) {
    const dateMatch = block.match(DATE_IN_TEXT);
    const dated = dateMatch
      ? isoDate(Number(dateMatch[1]), Number(dateMatch[2]), Number(dateMatch[3]))
      : null;

    if (dated) {
      takenAt = dated;
    }

    const place = placeFromBlock(block, dated && dateMatch ? dateMatch[0] : null);
    if (place) {
      location = place;
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
  return isoDate(parts.year, parts.month + 1, parts.day);
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
): Promise<GeoResult> {
  const key = geoKey(latitude, longitude);
  if (geoCache.has(key)) {
    return { status: "ok", name: geoCache.get(key) ?? null };
  }

  const inflight = geoInflight.get(key);
  if (inflight) {
    return inflight;
  }

  const request = enqueueGeo(async (): Promise<GeoResult> => {
    if (geoCache.has(key)) {
      return { status: "ok", name: geoCache.get(key) ?? null };
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
        return { status: "error" };
      }

      const data = (await response.json()) as {
        address?: Record<string, string | undefined>;
      };
      const name = data.address ? formatAddress(data.address) : null;
      geoCache.set(key, name);
      return { status: "ok", name };
    } catch {
      return { status: "error" };
    }
  });

  geoInflight.set(key, request);
  try {
    return await request;
  } finally {
    geoInflight.delete(key);
  }
}

async function detectMedia(
  filePath: string,
  name: string,
  needLocation: boolean,
  needDate: boolean,
): Promise<PhotoMeta> {
  const override = parseFilenameOverride(name);
  let location: string | null = needLocation ? override.location : null;
  let takenAt: string | null = needDate ? override.takenAt : null;

  if ((!needLocation || location) && (!needDate || takenAt)) {
    return { location, takenAt };
  }

  try {
    if (isQuickTimeName(name)) {
      const quicktime = await parseQuickTimeMeta(filePath);
      if (
        needDate &&
        !takenAt &&
        quicktime.year &&
        quicktime.month &&
        quicktime.day
      ) {
        takenAt = isoDate(quicktime.year, quicktime.month, quicktime.day);
      }
      if (
        needLocation &&
        !location &&
        quicktime.gps &&
        isValidGps(quicktime.gps.latitude, quicktime.gps.longitude)
      ) {
        const geo = await reverseGeocode(
          quicktime.gps.latitude,
          quicktime.gps.longitude,
        );
        if (geo.status === "ok") {
          location = geo.name;
        }
      }
    } else {
      const meta = (await exifr.parse(filePath, {
        gps: true,
        iptc: true,
        xmp: true,
        exif: true,
      })) as Record<string, unknown> | undefined;

      if (needDate && !takenAt) {
        takenAt = takenAtFromMeta(meta);
      }

      if (needLocation && !location) {
        location = locationFromTags(meta);
        const latitude =
          typeof meta?.latitude === "number" ? meta.latitude : undefined;
        const longitude =
          typeof meta?.longitude === "number" ? meta.longitude : undefined;

        if (
          !location &&
          latitude !== undefined &&
          longitude !== undefined &&
          isValidGps(latitude, longitude)
        ) {
          const geo = await reverseGeocode(latitude, longitude);
          if (geo.status === "ok") {
            location = geo.name;
          }
        }
      }
    }
  } catch {
    return { location, takenAt };
  }

  return { location, takenAt };
}

type Catalog = Record<string, PhotoMeta>;

function catalogPath(): string {
  return path.join(getMediaDir(), "metadata.json");
}

function textOrNull(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

async function readCatalog(): Promise<Catalog> {
  let raw: string;
  try {
    raw = await readFile(catalogPath(), "utf8");
  } catch (error) {
    if (
      error instanceof Error &&
      "code" in error &&
      error.code === "ENOENT"
    ) {
      return {};
    }
    throw error;
  }

  const data = JSON.parse(raw) as unknown;
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("metadata.json must be an object keyed by filename");
  }

  const catalog: Catalog = {};
  for (const [name, value] of Object.entries(data)) {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      continue;
    }
    const entry = value as { location?: unknown; takenAt?: unknown };
    catalog[name] = {
      location: textOrNull(entry.location),
      takenAt: textOrNull(entry.takenAt),
    };
  }
  return catalog;
}

function serializeCatalog(catalog: Catalog): string {
  const sorted: Catalog = {};
  for (const name of Object.keys(catalog).sort((left, right) =>
    left.localeCompare(right),
  )) {
    sorted[name] = catalog[name];
  }
  return `${JSON.stringify(sorted, null, 2)}\n`;
}

async function writeCatalog(catalog: Catalog): Promise<void> {
  const filePath = catalogPath();
  const tmp = `${filePath}.tmp`;
  await writeFile(tmp, serializeCatalog(catalog));
  await rename(tmp, filePath);
}

export async function libraryMetadata(
  files: { name: string; filePath: string }[],
): Promise<PhotoMeta[]> {
  const catalog = await readCatalog();
  const detected = new Map<string, PhotoMeta>();

  for (const file of files) {
    const current = catalog[file.name] ?? { location: null, takenAt: null };
    if (current.location && current.takenAt) {
      detected.set(file.name, { location: null, takenAt: null });
      continue;
    }

    detected.set(
      file.name,
      await detectMedia(
        file.filePath,
        file.name,
        !current.location,
        !current.takenAt,
      ),
    );
  }

  const latest = await readCatalog();
  const next: Catalog = {};
  let changed = Object.keys(latest).length !== files.length;

  for (const file of files) {
    const disk = latest[file.name] ?? { location: null, takenAt: null };
    const found = detected.get(file.name) ?? { location: null, takenAt: null };
    const location = disk.location ?? found.location;
    const takenAt = disk.takenAt ?? found.takenAt;
    if (
      !latest[file.name] ||
      disk.location !== location ||
      disk.takenAt !== takenAt
    ) {
      changed = true;
    }
    next[file.name] = { location, takenAt };
  }

  if (!changed) {
    changed = Object.keys(latest).some((name) => !next[name]);
  }

  if (changed) {
    await writeCatalog(next);
  }

  return files.map((file) => ({
    location: next[file.name].location,
    takenAt: captionDate(next[file.name].takenAt),
  }));
}
