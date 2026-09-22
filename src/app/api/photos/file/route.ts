import { playableMedia, readFileRange } from "@/lib/derived-media";
import { resolveMediaFile } from "@/lib/media";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const VIDEO_TYPES = new Set(["video/mp4", "video/webm", "video/quicktime"]);

function parseRange(
  rangeHeader: string | null,
  size: number,
): { start: number; end: number } | null | "invalid" {
  if (!rangeHeader) {
    return null;
  }

  const match = /^bytes=(\d*)-(\d*)$/.exec(rangeHeader);
  if (!match) {
    return "invalid";
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
    return "invalid";
  }

  return { start, end };
}

function mediaHeaders(
  contentType: string,
  size: number,
  extra: Record<string, string> = {},
): HeadersInit {
  const video = VIDEO_TYPES.has(contentType);
  return {
    "Content-Type": contentType,
    "Content-Length": String(size),
    "Accept-Ranges": "bytes",
    "Cache-Control": video
      ? "no-store, max-age=0"
      : "public, max-age=86400",
    "X-Content-Type-Options": "nosniff",
    ...extra,
  };
}

async function resolvePlayable(request: Request) {
  const url = new URL(request.url);
  const filename = url.searchParams.get("name");
  if (!filename) {
    return null;
  }

  const filePath = resolveMediaFile(filename);
  if (!filePath) {
    return null;
  }

  return { filename, ...(await playableMedia(filePath, filename)) };
}

export async function HEAD(request: Request) {
  try {
    const playable = await resolvePlayable(request);
    if (!playable) {
      return new Response("Not found", { status: 404 });
    }

    return new Response(null, {
      headers: mediaHeaders(playable.contentType, playable.size),
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

export async function GET(request: Request) {
  try {
    const playable = await resolvePlayable(request);
    if (!playable) {
      return new Response("Not found", { status: 404 });
    }

    const { filePath, contentType, size } = playable;
    const range = parseRange(
      VIDEO_TYPES.has(contentType) ? request.headers.get("range") : null,
      size,
    );

    if (range === "invalid") {
      return new Response(null, {
        status: 416,
        headers: {
          "Content-Range": `bytes */${size}`,
          "Accept-Ranges": "bytes",
          "Cache-Control": "no-store, max-age=0",
        },
      });
    }

    if (range) {
      const body = await readFileRange(filePath, range.start, range.end);
      return new Response(body, {
        status: 206,
        headers: mediaHeaders(contentType, body.byteLength, {
          "Content-Range": `bytes ${range.start}-${range.end}/${size}`,
        }),
      });
    }

    const body = await readFileRange(filePath, 0, size - 1);
    return new Response(body, {
      headers: mediaHeaders(contentType, body.byteLength),
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
