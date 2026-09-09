import { readdir } from "node:fs/promises";
import path from "node:path";
import { getMediaDir, MEDIA_EXTENSIONS } from "@/lib/media";

export const dynamic = "force-dynamic";

export async function GET() {
  const photosDir = getMediaDir();

  try {
    const entries = await readdir(photosDir, { withFileTypes: true });
    const photos = entries
      .filter((entry) => {
        if (!entry.isFile()) {
          return false;
        }

        const extension = path.extname(entry.name).toLowerCase();
        return MEDIA_EXTENSIONS.has(extension);
      })
      .map((entry) => `/api/photos/${encodeURIComponent(entry.name)}`);

    return Response.json(photos);
  } catch (error) {
    if (
      error instanceof Error &&
      "code" in error &&
      error.code === "ENOENT"
    ) {
      return Response.json([]);
    }

    throw error;
  }
}
