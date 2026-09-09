import { createReadStream } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { contentTypeFor, resolveMediaFile } from "@/lib/media";

export const dynamic = "force-dynamic";

const VIDEO_EXTENSIONS = new Set([".mov", ".mp4", ".webm"]);

function fileStream(
  filePath: string,
  start?: number,
  end?: number,
): ReadableStream<Uint8Array> {
  const nodeStream =
    start !== undefined && end !== undefined
      ? createReadStream(filePath, { start, end })
      : createReadStream(filePath);

  return Readable.toWeb(nodeStream) as ReadableStream<Uint8Array>;
}

function isVideoName(name: string): boolean {
  return VIDEO_EXTENSIONS.has(path.extname(name).toLowerCase());
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ filename: string }> },
) {
  const { filename: rawName } = await params;
  const filename = decodeURIComponent(rawName);
  const filePath = resolveMediaFile(filename);

  if (!filePath) {
    return new Response("Not found", { status: 404 });
  }

  try {
    const fileStat = await stat(filePath);
    if (!fileStat.isFile()) {
      return new Response("Not found", { status: 404 });
    }

    const size = fileStat.size;
    const contentType = contentTypeFor(filename);
    const video = isVideoName(filename);
    const rangeHeader = video ? request.headers.get("range") : null;

    if (rangeHeader) {
      const match = /^bytes=(\d*)-(\d*)$/.exec(rangeHeader);
      if (!match) {
        return new Response(null, {
          status: 416,
          headers: { "Content-Range": `bytes */${size}` },
        });
      }

      const start = match[1] ? Number(match[1]) : 0;
      const end = match[2] ? Number(match[2]) : size - 1;

      if (
        !Number.isFinite(start) ||
        !Number.isFinite(end) ||
        start < 0 ||
        end >= size ||
        start > end
      ) {
        return new Response(null, {
          status: 416,
          headers: { "Content-Range": `bytes */${size}` },
        });
      }

      return new Response(fileStream(filePath, start, end), {
        status: 206,
        headers: {
          "Content-Type": contentType,
          "Content-Length": String(end - start + 1),
          "Content-Range": `bytes ${start}-${end}/${size}`,
          "Accept-Ranges": "bytes",
          "Cache-Control": "public, max-age=3600",
        },
      });
    }

    if (!video) {
      const buffer = await readFile(filePath);
      return new Response(buffer, {
        headers: {
          "Content-Type": contentType,
          "Content-Length": String(buffer.byteLength),
          "Cache-Control": "public, max-age=86400",
          "X-Content-Type-Options": "nosniff",
        },
      });
    }

    return new Response(fileStream(filePath), {
      headers: {
        "Content-Type": contentType,
        "Content-Length": String(size),
        "Accept-Ranges": "bytes",
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch (error) {
    if (
      error instanceof Error &&
      "code" in error &&
      error.code === "ENOENT"
    ) {
      return new Response("Not found", { status: 404 });
    }

    throw error;
  }
}
