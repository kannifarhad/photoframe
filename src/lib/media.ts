import path from "node:path";

export const MEDIA_EXTENSIONS = new Set([
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
  ".mov",
  ".mp4",
  ".webm",
]);

export function getMediaDir(): string {
  const raw = process.env.MEDIA_DIR?.trim();
  const configured = raw && raw.length > 0 ? raw : "photos";
  return path.resolve(process.cwd(), configured);
}

export function isAllowedMediaName(name: string): boolean {
  if (!name || name !== path.basename(name) || name.includes("\0")) {
    return false;
  }

  return MEDIA_EXTENSIONS.has(path.extname(name).toLowerCase());
}

export function resolveMediaFile(name: string): string | null {
  if (!isAllowedMediaName(name)) {
    return null;
  }

  const dir = getMediaDir();
  const resolved = path.resolve(dir, name);
  const prefix = dir.endsWith(path.sep) ? dir : `${dir}${path.sep}`;

  if (resolved !== dir && !resolved.startsWith(prefix)) {
    return null;
  }

  return resolved;
}

export function contentTypeFor(name: string): string {
  switch (path.extname(name).toLowerCase()) {
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".png":
      return "image/png";
    case ".webp":
      return "image/webp";
    case ".mov":
      return "video/quicktime";
    case ".mp4":
      return "video/mp4";
    case ".webm":
      return "video/webm";
    default:
      return "application/octet-stream";
  }
}
