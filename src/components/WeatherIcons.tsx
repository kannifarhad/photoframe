import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

type WeatherScene =
  | "clear"
  | "partly"
  | "overcast"
  | "fog"
  | "rain"
  | "snow"
  | "thunder";

function Icon({ children, ...props }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      {...props}
    >
      {children}
    </svg>
  );
}

export function LocationIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 2.2c-3.7 0-6.7 3-6.7 6.7 0 4.9 6.1 12.2 6.4 12.5a.4.4 0 0 0 .6 0c.3-.3 6.4-7.6 6.4-12.5 0-3.7-3-6.7-6.7-6.7Zm0 9.1a2.4 2.4 0 1 1 0-4.8 2.4 2.4 0 0 1 0 4.8Z" />
    </Icon>
  );
}

export function ThermometerIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M10 13.2V5.8a2 2 0 1 1 4 0v7.4a3.5 3.5 0 1 1-4 0Zm2 5.3a1.8 1.8 0 1 0 0-3.6 1.8 1.8 0 0 0 0 3.6Zm.9-5.3V5.8a.9.9 0 1 0-1.8 0v7.4h1.8Z" />
    </Icon>
  );
}

export function DropletIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 2.4S6.2 9.1 6.2 13.4a5.8 5.8 0 0 0 11.6 0C17.8 9.1 12 2.4 12 2.4Zm-1.6 14.4a3.7 3.7 0 0 1-2.2-3.3c0-.4.3-.7.7-.7s.7.3.7.7a2.3 2.3 0 0 0 1.3 2.1c.4.2.5.6.3 1a.7.7 0 0 1-.8.2Z" />
    </Icon>
  );
}

export function WindIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 8.6h9.4a2.4 2.4 0 1 0-2.3-3.1.9.9 0 1 1-1.7-.6 4.2 4.2 0 1 1 4 5.5H4a.9.9 0 0 1 0-1.8Zm0 6.8h12.6a2.6 2.6 0 1 0-2.5-3.4.9.9 0 1 1-1.7-.6 4.4 4.4 0 1 1 4.2 5.8H4a.9.9 0 0 1 0-1.8Zm3.2 3.8H4a.9.9 0 0 1 0-1.8h3.2a1.6 1.6 0 1 0-1.5-2.1.9.9 0 1 1-1.7-.6 3.4 3.4 0 1 1 3.2 4.5Z" />
    </Icon>
  );
}

export function ArrowUpIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 4.2a.9.9 0 0 1 .6.3l5.2 5.2a.9.9 0 1 1-1.3 1.3L12.9 7.3v12.4a.9.9 0 0 1-1.8 0V7.3L7.5 11a.9.9 0 1 1-1.3-1.3l5.2-5.2a.9.9 0 0 1 .6-.3Z" />
    </Icon>
  );
}

export function ArrowDownIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 19.8a.9.9 0 0 1-.6-.3l-5.2-5.2A.9.9 0 1 1 7.5 13l3.6 3.7V4.3a.9.9 0 0 1 1.8 0v12.4L16.5 13a.9.9 0 1 1 1.3 1.3l-5.2 5.2a.9.9 0 0 1-.6.3Z" />
    </Icon>
  );
}

export function SunriseIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...props}>
      <defs>
        <linearGradient id="sunrise-disc" x1="12" y1="5" x2="12" y2="16" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FFE566" />
          <stop offset="100%" stopColor="#FF8A1F" />
        </linearGradient>
      </defs>
      <g fill="#FFC14D">
        <rect x="11.2" y="2.2" width="1.6" height="3.1" rx="0.8" />
        <rect
          x="11.2"
          y="2.2"
          width="1.6"
          height="3.1"
          rx="0.8"
          transform="rotate(40 12 12)"
        />
        <rect
          x="11.2"
          y="2.2"
          width="1.6"
          height="3.1"
          rx="0.8"
          transform="rotate(-40 12 12)"
        />
        <rect
          x="11.2"
          y="2.2"
          width="1.6"
          height="3.1"
          rx="0.8"
          transform="rotate(78 12 12)"
        />
        <rect
          x="11.2"
          y="2.2"
          width="1.6"
          height="3.1"
          rx="0.8"
          transform="rotate(-78 12 12)"
        />
      </g>
      <path
        d="M6.2 16.1a5.8 5.8 0 0 1 11.6 0H6.2Z"
        fill="url(#sunrise-disc)"
      />
      <rect x="3" y="16.35" width="18" height="1.7" rx="0.85" fill="#FFD7A0" />
    </svg>
  );
}

export function SunsetIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...props}>
      <defs>
        <linearGradient id="sunset-disc" x1="12" y1="6" x2="12" y2="16" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FFB347" />
          <stop offset="55%" stopColor="#FF5C39" />
          <stop offset="100%" stopColor="#C026D3" />
        </linearGradient>
      </defs>
      <g fill="#FF7A45">
        <rect x="11.2" y="2.4" width="1.6" height="2.6" rx="0.8" />
        <rect
          x="11.2"
          y="2.4"
          width="1.6"
          height="2.6"
          rx="0.8"
          transform="rotate(48 12 12)"
        />
        <rect
          x="11.2"
          y="2.4"
          width="1.6"
          height="2.6"
          rx="0.8"
          transform="rotate(-48 12 12)"
        />
      </g>
      <path
        d="M6.2 16.1a5.8 5.8 0 0 1 11.6 0H6.2Z"
        fill="url(#sunset-disc)"
      />
      <rect x="3" y="16.35" width="18" height="1.7" rx="0.85" fill="#F0A3C2" />
    </svg>
  );
}

function SunGlyph() {
  return (
    <>
      <circle cx="12" cy="12" r="4.1" />
      {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => (
        <rect
          key={deg}
          x="11.15"
          y="1.4"
          width="1.7"
          height="3.6"
          rx="0.85"
          transform={`rotate(${deg} 12 12)`}
        />
      ))}
    </>
  );
}

function MoonGlyph() {
  return (
    <path d="M16.8 3.4A8.8 8.8 0 1 0 20.6 16 7.1 7.1 0 0 1 16.8 3.4Z" />
  );
}

function CloudPath() {
  return (
    <path d="M7.1 18.6h10.2a4.1 4.1 0 0 0 .5-8.2 5.5 5.5 0 0 0-10.6-1.2 4.1 4.1 0 0 0-.1 9.4Z" />
  );
}

function CloudSunGlyph() {
  return (
    <>
      <circle cx="16.6" cy="7.4" r="2.6" />
      <rect x="16" y="1.5" width="1.2" height="2.2" rx="0.6" />
      <rect x="16" y="11.1" width="1.2" height="1.4" rx="0.6" />
      <rect x="21.3" y="6.8" width="1.6" height="1.2" rx="0.6" />
      <rect x="11.3" y="6.8" width="1.4" height="1.2" rx="0.6" />
      <path d="M7.1 19.2h10.2a4.1 4.1 0 0 0 .5-8.2 5.5 5.5 0 0 0-10.6-1.1 4.1 4.1 0 0 0-.1 9.3Z" />
    </>
  );
}

function CloudMoonGlyph() {
  return (
    <>
      <path d="M17.8 3.2a5.4 5.4 0 1 0 2.6 7.4 4.3 4.3 0 0 1-2.6-7.4Z" />
      <path d="M7.1 19.2h10.2a4.1 4.1 0 0 0 .5-8.2 5.5 5.5 0 0 0-10.6-1.1 4.1 4.1 0 0 0-.1 9.3Z" />
    </>
  );
}

function FogGlyph() {
  return (
    <>
      <path d="M7.2 13.4h10.2a4.1 4.1 0 0 0 .5-8.2A5.5 5.5 0 0 0 7.3 4.1a4.1 4.1 0 0 0-.1 9.3Z" />
      <rect x="4.4" y="16" width="15.2" height="1.6" rx="0.8" />
      <rect x="6.2" y="19.2" width="11.6" height="1.6" rx="0.8" />
    </>
  );
}

function RainGlyph() {
  return (
    <>
      <path d="M7.1 14.8h10.2a4.1 4.1 0 0 0 .5-8.2 5.5 5.5 0 0 0-10.6-1.2 4.1 4.1 0 0 0-.1 9.4Z" />
      <path d="M8.2 17.2a.7.7 0 0 1 .9.4l.7 1.8a.7.7 0 1 1-1.3.5l-.7-1.8a.7.7 0 0 1 .4-.9Zm3.6.4a.7.7 0 0 1 .9.4l1 2.6a.7.7 0 1 1-1.3.5l-1-2.6a.7.7 0 0 1 .4-.9Zm3.7-.4a.7.7 0 0 1 .9.4l.7 1.8a.7.7 0 1 1-1.3.5l-.7-1.8a.7.7 0 0 1 .4-.9Z" />
    </>
  );
}

function SnowGlyph() {
  return (
    <>
      <path d="M7.1 14.8h10.2a4.1 4.1 0 0 0 .5-8.2 5.5 5.5 0 0 0-10.6-1.2 4.1 4.1 0 0 0-.1 9.4Z" />
      <circle cx="8.6" cy="18.4" r="1" />
      <circle cx="12" cy="20.4" r="1" />
      <circle cx="15.6" cy="18.4" r="1" />
    </>
  );
}

function ThunderGlyph() {
  return (
    <>
      <path d="M7.1 14.4h10.2a4.1 4.1 0 0 0 .5-8.2 5.5 5.5 0 0 0-10.6-1.2 4.1 4.1 0 0 0-.1 9.4Z" />
      <path d="M13.6 14.2h-2.3l-.8 3.4h1.7l-1.6 4.4 4.3-5.6h-2.1l.8-2.2Z" />
    </>
  );
}

export function WeatherGlyph({
  scene,
  isDay,
  className,
}: {
  scene: WeatherScene;
  isDay: boolean;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      className={className}
    >
      {scene === "clear" && isDay ? <SunGlyph /> : null}
      {scene === "clear" && !isDay ? <MoonGlyph /> : null}
      {scene === "partly" && isDay ? <CloudSunGlyph /> : null}
      {scene === "partly" && !isDay ? <CloudMoonGlyph /> : null}
      {scene === "overcast" ? <CloudPath /> : null}
      {scene === "fog" ? <FogGlyph /> : null}
      {scene === "rain" ? <RainGlyph /> : null}
      {scene === "snow" ? <SnowGlyph /> : null}
      {scene === "thunder" ? <ThunderGlyph /> : null}
    </svg>
  );
}

const SUN = "#F5D14A";
const CLOUD = "#FFFFFF";
const CLOUD_SHADOW = "#E4EAF1";
const RAIN = "#8EC8F8";
const MOON = "#F3E7C7";
const BOLT = "#FFE566";

function HeroSun({ cx, cy, r }: { cx: number; cy: number; r: number }) {
  return (
    <g>
      {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => (
        <rect
          key={deg}
          x={cx - r * 0.12}
          y={cy - r * 2.05}
          width={r * 0.24}
          height={r * 0.55}
          rx={r * 0.12}
          fill={SUN}
          transform={`rotate(${deg} ${cx} ${cy})`}
        />
      ))}
      <circle cx={cx} cy={cy} r={r} fill={SUN} />
    </g>
  );
}

function HeroCloud() {
  return (
    <path
      d="M18 44.5h28.5c6.2 0 11.2-4.7 11.2-10.5 0-5.6-4.6-10.2-10.3-10.5-1.6-7.4-8.2-12.8-16-12.8-7.2 0-13.4 4.6-15.5 11.2C11.2 22.4 7 26.8 7 32.2 7 38.4 12.1 44.5 18 44.5Z"
      fill={CLOUD}
      stroke={CLOUD_SHADOW}
      strokeWidth="1.2"
    />
  );
}

export function WeatherHeroIcon({
  scene,
  isDay,
  className,
}: {
  scene: WeatherScene;
  isDay: boolean;
  className?: string;
}) {
  return (
    <svg viewBox="0 0 64 64" aria-hidden="true" className={className}>
      {scene === "clear" && isDay ? <HeroSun cx={32} cy={32} r={12} /> : null}
      {scene === "clear" && !isDay ? (
        <path
          d="M40.5 14.5A18 18 0 1 0 48 42.5 14.5 14.5 0 0 1 40.5 14.5Z"
          fill={MOON}
        />
      ) : null}
      {scene === "partly" && isDay ? (
        <>
          <HeroSun cx={24} cy={24} r={9.5} />
          <HeroCloud />
        </>
      ) : null}
      {scene === "partly" && !isDay ? (
        <>
          <path
            d="M42 13.5A13 13 0 1 0 47 33a11 11 0 0 1-5-19.5Z"
            fill={MOON}
          />
          <HeroCloud />
        </>
      ) : null}
      {scene === "overcast" || scene === "fog" ? <HeroCloud /> : null}
      {scene === "fog" ? (
        <>
          <rect x="12" y="50" width="40" height="3" rx="1.5" fill={CLOUD} />
          <rect x="16" y="56" width="32" height="3" rx="1.5" fill={CLOUD} opacity="0.7" />
        </>
      ) : null}
      {scene === "rain" || scene === "thunder" || scene === "snow" ? (
        <>
          <HeroCloud />
          {scene === "rain" || scene === "thunder" ? (
            <>
              <path d="M22 48.5 19.5 57" stroke={RAIN} strokeWidth="2.2" strokeLinecap="round" />
              <path d="M32 49.5 29.2 59" stroke={RAIN} strokeWidth="2.2" strokeLinecap="round" />
              <path d="M42 48.5 39.5 57" stroke={RAIN} strokeWidth="2.2" strokeLinecap="round" />
            </>
          ) : null}
          {scene === "snow" ? (
            <>
              <circle cx="22" cy="52" r="2" fill={CLOUD} />
              <circle cx="32" cy="56" r="2" fill={CLOUD} />
              <circle cx="43" cy="52" r="2" fill={CLOUD} />
            </>
          ) : null}
          {scene === "thunder" ? (
            <path d="M35 38h-6.5l-2.2 9h5L27.5 58l11.5-14.5H33l2-5.5Z" fill={BOLT} />
          ) : null}
        </>
      ) : null}
    </svg>
  );
}

export function SunriseMark(props: IconProps) {
  return (
    <svg viewBox="0 0 48 40" aria-hidden="true" {...props}>
      <circle cx="24" cy="16" r="7.5" fill={SUN} />
      <rect x="4" y="22.5" width="40" height="2.2" rx="1.1" fill="white" />
      <path d="M24 28.5 19.2 35h9.6L24 28.5Z" fill="white" />
    </svg>
  );
}

export function SunsetMark(props: IconProps) {
  return (
    <svg viewBox="0 0 48 40" aria-hidden="true" {...props}>
      <circle cx="24" cy="26" r="7.5" fill={SUN} />
      <rect x="4" y="16.2" width="40" height="2.2" rx="1.1" fill="white" />
      <path d="M24 37 19.2 30.5h9.6L24 37Z" fill="white" />
    </svg>
  );
}
