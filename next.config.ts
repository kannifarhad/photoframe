import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  allowedDevOrigins: ["192.168.0.11", "192.168.0.7"],
  serverExternalPackages: ["exifr", "heic-convert", "ffmpeg-static"],
};

export default nextConfig;
