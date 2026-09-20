import { readdir } from "node:fs/promises";
import path from "node:path";
import { getMediaDir, MEDIA_EXTENSIONS } from "@/lib/media";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, max-age=0, must-revalidate",
};

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
      .map(
        (entry) => `/api/photos/file?name=${encodeURIComponent(entry.name)}`,
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
