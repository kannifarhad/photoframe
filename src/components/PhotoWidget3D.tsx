"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const IMAGE_DURATION_MS = 8000;
const VIDEO_EXTENSIONS = new Set([".mov", ".mp4", ".webm"]);

function mediaLabel(src: string): string {
  const filename = src.split("/").pop() ?? "Media";
  return decodeURIComponent(
    filename.replace(/\.[^.]+$/, "").replace(/-/g, " "),
  );
}

function extensionOf(src: string): string {
  const filename = src.split("/").pop() ?? "";
  const dot = filename.lastIndexOf(".");
  return dot === -1 ? "" : filename.slice(dot).toLowerCase();
}

function isVideoSrc(src: string): boolean {
  return VIDEO_EXTENSIONS.has(extensionOf(src));
}

export default function PhotoWidget3D() {
  const [items, setItems] = useState<string[] | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const goToNext = useCallback(() => {
    setActiveIndex((current) => {
      if (!items || items.length === 0) {
        return current;
      }
      return (current + 1) % items.length;
    });
  }, [items]);

  useEffect(() => {
    const abortController = new AbortController();

    async function loadMedia() {
      try {
        const response = await fetch("/api/photos", {
          signal: abortController.signal,
        });
        if (!response.ok) {
          throw new Error(`Media request failed (${response.status})`);
        }

        const data: unknown = await response.json();
        if (
          !Array.isArray(data) ||
          data.some((item) => typeof item !== "string")
        ) {
          throw new Error("Invalid media response");
        }

        setItems(data);
        setActiveIndex(0);
        setError(null);
      } catch (caught) {
        if (caught instanceof DOMException && caught.name === "AbortError") {
          return;
        }

        setItems([]);
        setError(
          caught instanceof Error ? caught.message : "Unable to load media",
        );
      }
    }

    loadMedia();

    return () => abortController.abort();
  }, []);

  const activeSrc = items?.[activeIndex] ?? null;
  const activeIsVideo = activeSrc ? isVideoSrc(activeSrc) : false;

  useEffect(() => {
    if (!items || items.length === 0 || activeIsVideo) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      goToNext();
    }, IMAGE_DURATION_MS);

    return () => window.clearTimeout(timeoutId);
  }, [activeIndex, activeIsVideo, goToNext, items]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !activeIsVideo) {
      return;
    }

    let cancelled = false;

    async function startPlayback(player: HTMLVideoElement) {
      player.currentTime = 0;
      try {
        player.muted = false;
        await player.play();
      } catch {
        if (cancelled) {
          return;
        }
        try {
          player.muted = true;
          await player.play();
        } catch {
          if (!cancelled) {
            goToNext();
          }
        }
      }
    }

    void startPlayback(video);

    return () => {
      cancelled = true;
      video.pause();
    };
  }, [activeIndex, activeIsVideo, activeSrc, goToNext]);

  return (
    <div className="relative h-full w-full overflow-hidden rounded-3xl font-sans">
      {items === null ? (
        <p className="flex h-full items-center justify-center text-slate-400">
          Loading media…
        </p>
      ) : error ? (
        <p className="flex h-full items-center justify-center text-slate-300">
          {error}
        </p>
      ) : items.length === 0 ? (
        <div className="flex h-full flex-col items-center justify-center gap-2 px-4 text-center">
          <p className="text-lg font-medium tracking-wide text-white">
            No media to display
          </p>
          <p className="text-sm text-slate-400">
            Add photos or videos to the folder set in{" "}
            <span className="font-mono text-slate-300">MEDIA_DIR</span>
          </p>
        </div>
      ) : (
        <div
          aria-roledescription="carousel"
          aria-label="Media gallery"
          className="absolute inset-0 [mask-image:linear-gradient(to_top_right,transparent_8%,black_52%)] [-webkit-mask-image:linear-gradient(to_top_right,transparent_8%,black_52%)] [mask-size:100%_100%] [-webkit-mask-size:100%_100%] [mask-repeat:no-repeat] [-webkit-mask-repeat:no-repeat]"
        >
          {items.map((src, index) => {
            const isActive = index === activeIndex;
            const video = isVideoSrc(src);

            if (video && !isActive) {
              return null;
            }

            if (video) {
              return (
                <video
                  key={src}
                  ref={videoRef}
                  src={src}
                  aria-hidden={!isActive}
                  playsInline
                  preload="auto"
                  disablePictureInPicture
                  disableRemotePlayback
                  className="absolute inset-0 h-full w-full object-cover object-center"
                  onEnded={() => {
                    const player = videoRef.current;
                    if (items.length < 2 && player) {
                      player.currentTime = 0;
                      void player.play();
                      return;
                    }
                    goToNext();
                  }}
                  onError={() => goToNext()}
                />
              );
            }

            return (
              <img
                key={src}
                src={src}
                alt={mediaLabel(src)}
                draggable={false}
                aria-hidden={!isActive}
                className="absolute inset-0 h-full w-full object-cover object-center transition-opacity duration-700 ease-in-out"
                style={{ opacity: isActive ? 1 : 0 }}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
