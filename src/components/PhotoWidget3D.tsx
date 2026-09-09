"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

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
  const [readySrcs, setReadySrcs] = useState<Set<string>>(() => new Set());
  const [error, setError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const markReady = useCallback((src: string) => {
    setReadySrcs((current) => {
      if (current.has(src)) {
        return current;
      }
      const next = new Set(current);
      next.add(src);
      return next;
    });
  }, []);

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
        setReadySrcs(new Set());
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

  const visibleIndices = useMemo(() => {
    if (!items || items.length === 0) {
      return [];
    }

    const next = (activeIndex + 1) % items.length;
    if (next === activeIndex) {
      return [activeIndex];
    }
    return [activeIndex, next];
  }, [activeIndex, items]);

  const activeSrc = items?.[activeIndex] ?? null;
  const activeIsVideo = activeSrc ? isVideoSrc(activeSrc) : false;
  const activeReady = activeSrc ? readySrcs.has(activeSrc) : false;

  useEffect(() => {
    if (!items || items.length === 0 || activeIsVideo || !activeReady) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      goToNext();
    }, IMAGE_DURATION_MS);

    return () => window.clearTimeout(timeoutId);
  }, [activeIndex, activeIsVideo, activeReady, goToNext, items]);

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

  const showLoading =
    items === null || (items.length > 0 && !error && !activeReady);

  return (
    <div className="relative h-full w-full overflow-hidden rounded-3xl font-sans">
      {error ? (
        <p className="flex h-full items-center justify-center text-slate-300">
          {error}
        </p>
      ) : items?.length === 0 ? (
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
        <>
          {showLoading ? (
            <p className="flex h-full items-center justify-center text-slate-400">
              Loading media…
            </p>
          ) : null}
          {items && items.length > 0 ? (
            <div
              aria-roledescription="carousel"
              aria-label="Media gallery"
              className={`absolute inset-0 [mask-image:linear-gradient(to_top_right,transparent_8%,black_52%)] [-webkit-mask-image:linear-gradient(to_top_right,transparent_8%,black_52%)] [mask-size:100%_100%] [-webkit-mask-size:100%_100%] [mask-repeat:no-repeat] [-webkit-mask-repeat:no-repeat] ${showLoading ? "opacity-0" : ""}`}
            >
              {visibleIndices.map((index) => {
                const src = items[index];
                const isActive = index === activeIndex;
                const video = isVideoSrc(src);
                const ready = readySrcs.has(src);

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
                      onLoadedData={() => markReady(src)}
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
                    style={{ opacity: isActive && ready && !showLoading ? 1 : 0 }}
                    onLoad={(event) => {
                      const image = event.currentTarget;
                      void image.decode().then(
                        () => markReady(src),
                        () => markReady(src),
                      );
                    }}
                    onError={() => goToNext()}
                  />
                );
              })}
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
