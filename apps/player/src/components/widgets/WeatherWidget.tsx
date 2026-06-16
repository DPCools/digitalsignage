'use client';
export function WeatherWidget({ apiKey, location }: { apiKey?: string; location?: string }) {
  if (!apiKey || !location) return null;
  return (
    <div className="flex items-center justify-center h-full text-white text-sm px-4">
      Weather: {location}
    </div>
  );
}
