import { readdir } from "node:fs/promises";
import { warmupPlayable } from "@/lib/derived-media";
import { getMediaDir, isAllowedMediaName, resolveMediaFile } from "@/lib/media";
import { metadataForMediaFile } from "@/lib/photo-location";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, max-age=0, must-revalidate",
};

export async function GET() {
  const photosDir = getMediaDir();

  try {
    const entries = await readdir(photosDir, { withFileTypes: true });
    const files = entries.filter(
      (entry) => entry.isFile() && isAllowedMediaName(entry.name),
    );

    const photos = await Promise.all(
      files.map(async (entry) => {
        const src = `/api/photos/file?name=${encodeURIComponent(entry.name)}`;
        const filePath = resolveMediaFile(entry.name);
        if (filePath) {
          warmupPlayable(filePath, entry.name);
        }
        const meta = filePath
          ? await metadataForMediaFile(filePath, entry.name)
          : { location: null, takenAt: null };
        return { src, ...meta };
      }),
    );

    return Response.json(photos, { headers: NO_STORE_HEADERS });
  } catch (error) {
    if (
      error instanceof Error &&
      "code" in error &&
      error.code === "ENOENT"
    ) {
      return Response.json([], { headers: NO_STORE_HEADERS });
    }

    throw error;
  }
}
