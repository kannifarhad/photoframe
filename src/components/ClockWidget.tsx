"use client";

import { useEffect, useState } from "react";
import styles from "./ClockWidget.module.css";

function formatTimeParts(date: Date): { hours: string; minutes: string } {
  return {
    hours: String(date.getHours()).padStart(2, "0"),
    minutes: String(date.getMinutes()).padStart(2, "0"),
  };
}

const MONTHS = [
  "Jan.",
  "Feb.",
  "Mar.",
  "Apr.",
  "May",
  "Jun.",
  "Jul.",
  "Aug.",
  "Sept.",
  "Oct.",
  "Nov.",
  "Dec.",
];

function formatDate(date: Date): string {
  const weekday = date.toLocaleDateString("en-US", { weekday: "short" });
  const month = MONTHS[date.getMonth()];
  return `${weekday}, ${month} ${date.getDate()}`;
}

export default function ClockWidget() {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    const tick = () => setNow(new Date());
    tick();
    const intervalId = window.setInterval(tick, 1000);
    return () => window.clearInterval(intervalId);
  }, []);

  const time = now ? formatTimeParts(now) : { hours: "--", minutes: "--" };
  const date = now ? formatDate(now) : "\u00a0";

  return (
    <div className="flex h-full min-w-0 flex-col items-center justify-center overflow-hidden rounded-3xl bg-slate-900/40 px-2 py-3 text-center">
      <time dateTime={now?.toISOString()} className={styles.time}>
        <span className={styles.hours}>{time.hours}</span>
        <span className={styles.colon}>:</span>
        <span className={styles.minutes}>{time.minutes}</span>
      </time>
      <p className={styles.date}>{date}</p>
    </div>
  );
}
