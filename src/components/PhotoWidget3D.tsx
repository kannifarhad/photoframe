"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import styles from "./PhotoWidget3D.module.css";



const IMAGE_DURATION_MS = 8000;
const FADE_MS = 800;
const POLL_INTERVAL_MS = 30_000;
const VIDEO_EXTENSIONS = new Set([".mov", ".mp4", ".webm"]);

function filenameFromSrc(src: string): string {
  try {
    return new URL(src, "http://local").searchParams.get("name") ?? src;
  } catch {
    return src;
  }
}

function mediaLabel(src: string): string {
  const filename = filenameFromSrc(src);
  try {
    return decodeURIComponent(
      filename.replace(/\.[^.]+$/, "").replace(/-/g, " "),
    );
  } catch {
    return filename;
  }
}

function extensionOf(src: string): string {
  const filename = filenameFromSrc(src);
  const dot = filename.lastIndexOf(".");
  return dot === -1 ? "" : filename.slice(dot).toLowerCase();
}

function isVideoSrc(src: string): boolean {
  return VIDEO_EXTENSIONS.has(extensionOf(src));
}

type GalleryItem = {
  src: string;
  location: string | null;
  takenAt: string | null;
};

function isGalleryItem(value: unknown): value is GalleryItem {
  if (!value || typeof value !== "object") {
    return false;
  }

  const item = value as {
    src?: unknown;
    location?: unknown;
    takenAt?: unknown;
  };
  return (
    typeof item.src === "string" &&
    (item.location === null || typeof item.location === "string") &&
    (item.takenAt === null || typeof item.takenAt === "string")
  );
}

function listsEqual(left: GalleryItem[], right: GalleryItem[]): boolean {
  return (
    left.length === right.length &&
    left.every(
      (item, index) =>
        item.src === right[index].src &&
        item.location === right[index].location &&
        item.takenAt === right[index].takenAt,
    )
  );
}

function srcsEqual(left: GalleryItem[], right: GalleryItem[]): boolean {
  return (
    left.length === right.length &&
    left.every((item, index) => item.src === right[index].src)
  );
}

export default function PhotoWidget3D() {
  const [items, setItems] = useState<GalleryItem[] | null>(null);
  const [baseIndex, setBaseIndex] = useState(0);
  const [incomingIndex, setIncomingIndex] = useState<number | null>(null);
  const [incomingOn, setIncomingOn] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const itemsRef = useRef<GalleryItem[] | null>(null);
  const baseIndexRef = useRef(0);

  itemsRef.current = items;
  baseIndexRef.current = baseIndex;

  const goToNext = useCallback(() => {
    if (!items || items.length < 2 || incomingIndex !== null) {
      return;
    }

    const nextIndex = (baseIndex + 1) % items.length;
    const fromVideo = isVideoSrc(items[baseIndex].src);
    const toVideo = isVideoSrc(items[nextIndex].src);

    if (fromVideo || toVideo) {
      setBaseIndex(nextIndex);
      return;
    }

    setIncomingIndex(nextIndex);
    setIncomingOn(false);
  }, [baseIndex, incomingIndex, items]);

  useEffect(() => {
    const abortController = new AbortController();

    async function loadMedia() {
      try {
        const response = await fetch(`/api/photos?t=${Date.now()}`, {
          cache: "no-store",
          signal: abortController.signal,
        });
        if (!response.ok) {
          throw new Error(`Media request failed (${response.status})`);
        }

        const data: unknown = await response.json();
        if (!Array.isArray(data) || !data.every(isGalleryItem)) {
          throw new Error("Invalid media response");
        }

        const nextItems = data;
        const currentItems = itemsRef.current;

        if (currentItems && listsEqual(currentItems, nextItems)) {
          setError(null);
          return;
        }

        if (currentItems && srcsEqual(currentItems, nextItems)) {
          setItems(nextItems);
          setError(null);
          return;
        }

        const currentSrc = currentItems?.[baseIndexRef.current]?.src;
        const keptIndex = currentSrc
          ? nextItems.findIndex((item) => item.src === currentSrc)
          : -1;

        setItems(nextItems);
        setBaseIndex(keptIndex === -1 ? 0 : keptIndex);
        setIncomingIndex(null);
        setIncomingOn(false);
        setError(null);
      } catch (caught) {
        if (caught instanceof DOMException && caught.name === "AbortError") {
          return;
        }

        if (itemsRef.current && itemsRef.current.length > 0) {
          return;
        }

        setItems([]);
        setError(
          caught instanceof Error ? caught.message : "Unable to load media",
        );
      }
    }

    loadMedia();
    const intervalId = window.setInterval(loadMedia, POLL_INTERVAL_MS);

    return () => {
      abortController.abort();
      window.clearInterval(intervalId);
    };
  }, []);

  useEffect(() => {
    if (incomingIndex === null) {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        setIncomingOn(true);
      });
    });

    const done = window.setTimeout(() => {
      setBaseIndex(incomingIndex);
      setIncomingIndex(null);
      setIncomingOn(false);
    }, FADE_MS);

    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(done);
    };
  }, [incomingIndex]);

  const baseSrc = items?.[baseIndex]?.src ?? null;
  const baseLocation = items?.[baseIndex]?.location ?? null;
  const baseTakenAt = items?.[baseIndex]?.takenAt ?? null;
  const baseIsVideo = baseSrc ? isVideoSrc(baseSrc) : false;
  const incomingSrc =
    items && incomingIndex !== null ? items[incomingIndex].src : null;
  const incomingLocation =
    items && incomingIndex !== null ? items[incomingIndex].location : null;
  const incomingTakenAt =
    items && incomingIndex !== null ? items[incomingIndex].takenAt : null;
  const nextIndex =
    items && items.length > 1 ? (baseIndex + 1) % items.length : null;
  const nextSrc =
    nextIndex !== null && items && !isVideoSrc(items[nextIndex].src)
      ? items[nextIndex].src
      : null;
  const captionLocation = incomingOn ? incomingLocation : baseLocation;
  const captionTakenAt = incomingOn ? incomingTakenAt : baseTakenAt;
  const hasCaption = Boolean(captionLocation || captionTakenAt);

  useEffect(() => {
    if (!items || items.length === 0 || baseIsVideo || incomingIndex !== null) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      goToNext();
    }, IMAGE_DURATION_MS);

    return () => window.clearTimeout(timeoutId);
  }, [baseIndex, baseIsVideo, goToNext, incomingIndex, items]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !baseIsVideo) {
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
  }, [baseIndex, baseIsVideo, baseSrc, goToNext]);

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
          className={styles.stage}
        >
          {nextSrc && nextSrc !== incomingSrc ? (
            <img src={nextSrc} alt="" className={styles.preload} />
          ) : null}

          {baseIsVideo && baseSrc ? (
            <video
              key={baseSrc}
              ref={videoRef}
              src={baseSrc}
              playsInline
              preload="auto"
              disablePictureInPicture
              disableRemotePlayback
              className={`${styles.frame} ${styles.base}`}
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
          ) : baseSrc ? (
            <img
              src={baseSrc}
              alt={mediaLabel(baseSrc)}
              draggable={false}
              className={`${styles.frame} ${styles.base}`}
              onError={() => goToNext()}
            />
          ) : null}

          {incomingSrc ? (
            <img
              src={incomingSrc}
              alt={mediaLabel(incomingSrc)}
              draggable={false}
              className={`${styles.frame} ${styles.incoming} ${incomingOn ? styles.incomingOn : ""}`}
              onError={() => goToNext()}
            />
          ) : null}

          {hasCaption ? (
            <div className={styles.caption}>
              {captionLocation ? (
                <p className={styles.place}>{captionLocation}</p>
              ) : null}
              {captionTakenAt ? (
                <p className={styles.taken}>{captionTakenAt}</p>
              ) : null}
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
