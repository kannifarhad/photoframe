import ClockWidget from "@/components/ClockWidget";
import PhotoWidget3D from "@/components/PhotoWidget3D";
import WeatherWidget from "@/components/WeatherWidget";

export default function Home() {
  return (
    <main className="scrollbar-none relative box-border h-[100vh] w-[100vw] overflow-hidden bg-[#090d16]">
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="kiosk-bg-pattern" />
        <div className="kiosk-bg-overlay" />
      </div>
      <div className="absolute inset-y-0 left-0 z-10 flex w-1/2 flex-col gap-6 p-6">
        <div className="grid min-h-0 gap-6">
          <section className="min-h-0 min-w-0">
            <ClockWidget />
          </section>
          <section className="min-h-0 min-w-0">
            <WeatherWidget />
          </section>
        </div>
      </div>
      <section className="absolute inset-y-0 right-0 z-10 flex w-1/2 min-h-0 min-w-0 items-center justify-center overflow-hidden p-6 pl-0">
        <PhotoWidget3D />
      </section>
    </main>
  );
}
