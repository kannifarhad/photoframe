import { readdir } from "node:fs/promises";
import { pruneDerivedCache, warmupPlayable } from "@/lib/derived-media";
import { getMediaDir, isAllowedMediaName, resolveMediaFile } from "@/lib/media";
import { libraryMetadata } from "@/lib/photo-location";

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

    const names = files.map((entry) => entry.name);
    void pruneDerivedCache(names);

    const ready = files.flatMap((entry) => {
      const filePath = resolveMediaFile(entry.name);
      if (!filePath) {
        return [];
      }
      warmupPlayable(filePath, entry.name);
      return [{ name: entry.name, filePath }];
    });
    const metas = await libraryMetadata(ready);
    const photos = ready.map((file, index) => ({
      src: `/api/photos/file?name=${encodeURIComponent(file.name)}`,
      ...metas[index],
    }));

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
