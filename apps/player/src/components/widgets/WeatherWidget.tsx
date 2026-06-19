'use client';
import { useEffect, useState } from 'react';

interface WeatherData {
  temp: number;
  description: string;
  icon: string;
}

export function WeatherWidget({ apiKey, location }: { apiKey?: string; location?: string }) {
  const [weather, setWeather] = useState<WeatherData | null>(null);

  useEffect(() => {
    if (!apiKey || !location) return;
    const fetchWeather = async () => {
      try {
        const res = await fetch(
          `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(location)}&appid=${apiKey}&units=metric`
        );
        const data = await res.json();
        setWeather({
          temp: Math.round(data.main.temp),
          description: data.weather[0].description,
          icon: data.weather[0].icon,
        });
      } catch { /* non-fatal */ }
    };
    fetchWeather();
    const interval = setInterval(fetchWeather, 10 * 60 * 1000);
    return () => clearInterval(interval);
  }, [apiKey, location]);

  if (!weather) return null;

  return (
    <div className="flex items-center justify-center gap-2 h-full bg-black/60 px-4">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`https://openweathermap.org/img/wn/${weather.icon}.png`}
        alt={weather.description}
        className="h-8 w-8"
      />
      <span className="text-white text-lg font-mono">{weather.temp}°C</span>
    </div>
  );
}
