"use client";

import { useEffect, useMemo, useState } from "react";
import styles from "./WeatherWidget.module.css";

const OPEN_METEO_URL = "https://api.open-meteo.com/v1/forecast";
const REFRESH_INTERVAL_MS = 15 * 60 * 1000;
const DEFAULT_LATITUDE = 40.4093;
const DEFAULT_LONGITUDE = 49.8671;
const DEFAULT_LOCATION = "Baku";

const COMPASS = [
  "N",
  "NNE",
  "NE",
  "ENE",
  "E",
  "ESE",
  "SE",
  "SSE",
  "S",
  "SSW",
  "SW",
  "WSW",
  "W",
  "WNW",
  "NW",
  "NNW",
];

type WeatherWidgetProps = {
  latitude?: number;
  longitude?: number;
  location?: string;
};

type ForecastResponse = {
  current: {
    temperature_2m: number;
    apparent_temperature: number;
    weather_code: number;
    is_day: number;
    wind_speed_10m: number;
    wind_direction_10m: number;
    relative_humidity_2m: number;
  };
  daily: {
    sunrise: string[];
    sunset: string[];
    uv_index_max: number[];
  };
};

type WeatherData = {
  temperature: number;
  feelsLike: number;
  weatherCode: number;
  isDay: boolean;
  windSpeed: number;
  windDirection: number;
  humidity: number;
  uvIndex: number;
  sunrise: string;
  sunset: string;
};

type WeatherScene =
  | "clear"
  | "partly"
  | "overcast"
  | "fog"
  | "rain"
  | "snow"
  | "thunder";

type WeatherCondition = {
  label: string;
  scene: WeatherScene;
};

function weatherFromCode(code: number, isDay: boolean): WeatherCondition {
  if (code === 0) {
    return { label: isDay ? "Sunny" : "Clear", scene: "clear" };
  }
  if (code === 1 || code === 2) {
    return {
      label:
        code === 1
          ? isDay
            ? "Mostly Sunny"
            : "Mostly Clear"
          : "Partly Cloudy",
      scene: "partly",
    };
  }
  if (code === 3) {
    return { label: "Overcast", scene: "overcast" };
  }
  if (code === 45 || code === 48) {
    return { label: "Foggy", scene: "fog" };
  }
  if (code >= 51 && code <= 57) {
    return { label: "Drizzle", scene: "rain" };
  }
  if (code >= 61 && code <= 67) {
    return { label: "Rain", scene: "rain" };
  }
  if (code >= 71 && code <= 77) {
    return { label: "Snow", scene: "snow" };
  }
  if (code >= 80 && code <= 82) {
    return { label: "Showers", scene: "rain" };
  }
  if (code === 85 || code === 86) {
    return { label: "Snow Showers", scene: "snow" };
  }
  if (code >= 95) {
    return { label: "Thunderstorm", scene: "thunder" };
  }

  return { label: "Unknown", scene: "overcast" };
}

function meteoconName(code: number, isDay: boolean): string {
  if (code === 0) {
    return isDay ? "clear-day" : "clear-night";
  }
  if (code === 1 || code === 2) {
    return isDay ? "partly-cloudy-day" : "partly-cloudy-night";
  }
  if (code === 3) {
    return isDay ? "overcast-day" : "overcast-night";
  }
  if (code === 45 || code === 48) {
    return isDay ? "fog-day" : "fog-night";
  }
  if (code >= 51 && code <= 57) {
    return "drizzle";
  }
  if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) {
    return "rain";
  }
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) {
    return "snow";
  }
  if (code >= 95) {
    return isDay ? "thunderstorms-day" : "thunderstorms-night";
  }
  return "cloudy";
}

function Meteocon({
  name,
  label,
  className,
}: {
  name: string;
  label: string;
  className?: string;
}) {
  return (
    // Meteocons are animated SVGs; img preserves SMIL animation.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`/meteocons/${name}.svg`}
      alt={label}
      draggable={false}
      className={className}
    />
  );
}

function sceneGradient(scene: WeatherScene, isDay: boolean): string {
  if (!isDay) {
    if (scene === "clear") {
      return "linear-gradient(180deg, #1b3b78 0%, #0b1638 100%)";
    }
    if (scene === "rain" || scene === "thunder") {
      return "linear-gradient(180deg, #3a4558 0%, #1a202c 100%)";
    }
    if (scene === "overcast" || scene === "partly" || scene === "fog") {
      return "linear-gradient(180deg, #5b6a7e 0%, #2f3848 100%)";
    }
    return "linear-gradient(180deg, #3d4a5c 0%, #1c2330 100%)";
  }

  switch (scene) {
    case "clear":
      return "linear-gradient(180deg, #47b4f5 0%, #1d6fd4 100%)";
    case "partly":
      return "linear-gradient(180deg, #6aa7d8 0%, #3d7ec0 100%)";
    case "overcast":
      return "linear-gradient(180deg, #8fa4b8 0%, #5d6f82 100%)";
    case "fog":
      return "linear-gradient(180deg, #b7c2cc 0%, #7d8b98 100%)";
    case "rain":
      return "linear-gradient(180deg, #6b7c90 0%, #3e4a59 100%)";
    case "snow":
      return "linear-gradient(180deg, #c5d2de 0%, #7e90a3 100%)";
    case "thunder":
      return "linear-gradient(180deg, #4c5668 0%, #232836 100%)";
  }
}

function formatDegrees(value: number): string {
  if (!Number.isFinite(value)) {
    return "–°";
  }
  return `${Math.round(value)}°`;
}

function formatSunTime(iso: string): string {
  const match = iso.match(/T(\d{2}):(\d{2})/);
  if (match) {
    return `${match[1]}:${match[2]}`;
  }

  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return "–";
  }

  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function compassFromDegrees(deg: number): string {
  if (!Number.isFinite(deg)) {
    return "";
  }
  const index = Math.round(deg / 22.5) % 16;
  return COMPASS[(index + 16) % 16];
}

function hash01(n: number, salt: number) {
  const x = Math.sin(n * 12.9898 + salt * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

type RainLayer = "far" | "mid" | "near";

function RainField() {
  const drops = useMemo(() => {
    const make = (count: number, layer: RainLayer, salt: number) =>
      Array.from({ length: count }, (_, index) => {
        const a = hash01(index, salt);
        const b = hash01(index, salt + 11);
        const c = hash01(index, salt + 23);

        if (layer === "far") {
          return {
            layer,
            left: `${a * 100}%`,
            width: 1.15,
            height: 12 + b * 10,
            delay: `${-c * 2}s`,
            duration: `${1.05 + b * 0.35}s`,
          };
        }

        if (layer === "mid") {
          return {
            layer,
            left: `${a * 100}%`,
            width: 1.45,
            height: 18 + b * 14,
            delay: `${-c * 1.6}s`,
            duration: `${0.62 + b * 0.24}s`,
          };
        }

        return {
          layer,
          left: `${a * 100}%`,
          width: 1.85,
          height: 26 + b * 18,
          delay: `${-c * 1.2}s`,
          duration: `${0.38 + b * 0.2}s`,
        };
      });

    return [...make(70, "far", 1), ...make(48, "mid", 2), ...make(28, "near", 3)];
  }, []);

  return (
    <div className={styles.rain}>
      {drops.map((drop, index) => (
        <span
          key={index}
          className={`${styles.rainDrop} ${
            drop.layer === "far"
              ? styles.rainFar
              : drop.layer === "mid"
                ? styles.rainMid
                : styles.rainNear
          } weather-motion`}
          style={{
            left: drop.left,
            width: drop.width,
            height: drop.height,
            animationDelay: drop.delay,
            animationDuration: drop.duration,
          }}
        />
      ))}
    </div>
  );
}

function SnowField() {
  const flakes = useMemo(
    () =>
      Array.from({ length: 22 }, (_, index) => ({
        left: `${(index * 37 + 11) % 100}%`,
        delay: `${((index * 0.17) % 2.2).toFixed(2)}s`,
        duration: `${3.4 + (index % 6) * 0.18}s`,
        size: 4 + (index % 4),
      })),
    [],
  );

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {flakes.map((flake, index) => (
        <span
          key={index}
          className="weather-motion absolute top-[-12%] rounded-full bg-white"
          style={{
            left: flake.left,
            width: flake.size,
            height: flake.size,
            opacity: 0.55,
            animation: `weather-fall ${flake.duration} linear ${flake.delay} infinite`,
          }}
        />
      ))}
    </div>
  );
}

function WeatherAtmosphere({
  scene,
  isDay,
}: {
  scene: WeatherScene;
  isDay: boolean;
}) {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {(scene === "clear" || scene === "partly") && (
        <div
          className="weather-motion absolute -top-10 -right-6 h-44 w-44 rounded-full bg-white/35 blur-2xl"
          style={{ animation: "weather-glow 7s ease-in-out infinite" }}
        />
      )}

      {(scene === "partly" || scene === "overcast" || scene === "fog") && (
        <>
          <div
            className="weather-motion absolute top-[18%] -left-[10%] h-24 w-56 rounded-full bg-white/40 blur-2xl"
            style={{ animation: "weather-drift 18s ease-in-out infinite alternate" }}
          />
          <div
            className="weather-motion absolute top-[38%] left-[20%] h-20 w-64 rounded-full bg-white/28 blur-2xl"
            style={{
              animation: "weather-drift 22s ease-in-out infinite alternate-reverse",
            }}
          />
        </>
      )}

      {scene === "fog" && (
        <div className="absolute inset-0 bg-white/20 backdrop-blur-[2px]" />
      )}

      {(scene === "rain" || scene === "thunder") && <RainField />}
      {scene === "snow" && <SnowField />}

      {scene === "thunder" && (
        <div
          className="weather-motion absolute inset-0 bg-white"
          style={{ animation: "weather-flash 5.5s ease-in-out infinite" }}
        />
      )}

      {!isDay && scene === "clear" && (
        <div className="absolute top-8 right-10 h-3 w-3 rounded-full bg-white/80 shadow-[0_0_24px_rgba(255,255,255,0.8)]" />
      )}
    </div>
  );
}

function MetricRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="contents">
      <span className={styles.metricLabel}>{label}</span>
      <span className={styles.metricValue}>{value}</span>
    </div>
  );
}

export default function WeatherWidget({
  latitude = DEFAULT_LATITUDE,
  longitude = DEFAULT_LONGITUDE,
  location = DEFAULT_LOCATION,
}: WeatherWidgetProps) {
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const abortController = new AbortController();

    async function loadWeather() {
      try {
        const url = new URL(OPEN_METEO_URL);
        url.searchParams.set("latitude", String(latitude));
        url.searchParams.set("longitude", String(longitude));
        url.searchParams.set(
          "current",
          "temperature_2m,apparent_temperature,weather_code,is_day,wind_speed_10m,wind_direction_10m,relative_humidity_2m",
        );
        url.searchParams.set("daily", "sunrise,sunset,uv_index_max");
        url.searchParams.set("timezone", "auto");

        const response = await fetch(url, { signal: abortController.signal });
        if (!response.ok) {
          throw new Error(`Weather request failed (${response.status})`);
        }

        const data = (await response.json()) as ForecastResponse;
        if (!data.current || !data.daily) {
          throw new Error("Invalid weather response");
        }

        setWeather({
          temperature: data.current.temperature_2m,
          feelsLike: data.current.apparent_temperature,
          weatherCode: data.current.weather_code,
          isDay: data.current.is_day === 1,
          windSpeed: data.current.wind_speed_10m,
          windDirection: data.current.wind_direction_10m,
          humidity: data.current.relative_humidity_2m,
          uvIndex: data.daily.uv_index_max[0] ?? 0,
          sunrise: data.daily.sunrise[0] ?? "",
          sunset: data.daily.sunset[0] ?? "",
        });
        setError(null);
      } catch (caught) {
        if (caught instanceof DOMException && caught.name === "AbortError") {
          return;
        }

        setError(
          caught instanceof Error ? caught.message : "Unable to load weather",
        );
      }
    }

    loadWeather();
    const intervalId = window.setInterval(loadWeather, REFRESH_INTERVAL_MS);

    return () => {
      abortController.abort();
      window.clearInterval(intervalId);
    };
  }, [latitude, longitude]);

  const condition = weather
    ? weatherFromCode(weather.weatherCode, weather.isDay)
    : null;
  const isDay = weather?.isDay ?? true;

  return (
    <div
      className={styles.widget}
      style={{
        background: condition
          ? sceneGradient(condition.scene, isDay)
          : "linear-gradient(180deg, #2a3144 0%, #141822 100%)",
      }}
    >
      {condition ? (
        <WeatherAtmosphere scene={condition.scene} isDay={isDay} />
      ) : null}

      {error && !weather ? (
        <p className={styles.status}>{error}</p>
      ) : !weather || !condition ? (
        <p className={styles.status}>Loading weather…</p>
      ) : (
        <div className={styles.body}>
          <Meteocon
            name={meteoconName(weather.weatherCode, isDay)}
            label={condition.label}
            className={styles.heroIcon}
          />
          <div className={styles.grid}>
            <div className={styles.left}>
              <div>
                <p className={styles.location}>{condition.label}</p>
               
              </div>
              <div>
                {/* <p className={styles.condition}>{location}</p> */}
                <p className={styles.temp}>
                  {Math.round(weather.temperature)}°C
                </p>
                <p className={styles.feelsLike}>
                  Feels like {formatDegrees(weather.feelsLike)}
                </p>
              </div>
            </div>

            <div className={styles.right}>
              <div className={styles.metrics}>
                <MetricRow
                  label="UV Index"
                  value={`${Math.round(weather.uvIndex)} of 10`}
                />
                <MetricRow
                  label="Wind"
                  value={`${compassFromDegrees(weather.windDirection)} ${Math.round(weather.windSpeed)} km/h`}
                />
                <MetricRow
                  label="Humidity"
                  value={`${Math.round(weather.humidity)}%`}
                />
              </div>

              <div className={styles.suns}>
                <div className={styles.sun}>
                  <p className={styles.sunTime}>
                    {formatSunTime(weather.sunrise)}
                  </p>
                  <Meteocon
                    name="sunrise"
                    label="Sunrise"
                    className={styles.sunIcon}
                  />
                </div>
                <div className={styles.sun}>
                  <p className={styles.sunTime}>
                    {formatSunTime(weather.sunset)}
                  </p>
                  <Meteocon
                    name="moonset"
                    label="Sunset"
                    className={styles.sunIcon}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
