export interface WeatherData {
  temp: number;
  feelsLike: number;
  humidity: number;
  precipProb: number;
  weatherCode: number;
  isDay: boolean;
  condition: WeatherCondition;
  suggestion: string | null;
}

export type WeatherCondition =
  | 'clear'
  | 'cloudy'
  | 'fog'
  | 'drizzle'
  | 'rain'
  | 'snow'
  | 'storm'
  | 'unknown';

export function getCondition(code: number): WeatherCondition {
  if (code === 0) return 'clear';
  if ([1, 2, 3].includes(code)) return 'cloudy';
  if ([45, 48].includes(code)) return 'fog';
  if ([51, 53, 55, 56, 57].includes(code)) return 'drizzle';
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return 'rain';
  if ([71, 73, 75, 77, 85, 86].includes(code)) return 'snow';
  if ([95, 96, 99].includes(code)) return 'storm';
  return 'unknown';
}

function getSuggestion(
  temp: number,
  precipProb: number,
  condition: WeatherCondition
): string | null {
  if (condition === 'storm') return 'tormenta en camino';
  if (condition === 'fog') return 'niebla, maneja con cuidado';
  if (precipProb >= 70) return 'probablemente llueva hoy';
  if (precipProb >= 40) return 'podría llover más tarde';
  if (temp <= 8) return 'hace frío, abrígate';
  if (temp >= 28) return 'calor intenso, hidratate';
  return null;
}

export async function fetchWeather(
  lat: number,
  lng: number
): Promise<WeatherData> {
  const url = new URL('https://api.open-meteo.com/v1/forecast');
  url.searchParams.set('latitude', String(lat));
  url.searchParams.set('longitude', String(lng));
  url.searchParams.set(
    'current',
    'temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,is_day,precipitation_probability'
  );
  url.searchParams.set('timezone', 'auto');
  url.searchParams.set('forecast_days', '1');

  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`Weather API error: ${res.status}`);

  const data = await res.json();
  const current = data.current;

  const temp = Math.round(current.temperature_2m);
  const condition = getCondition(current.weather_code);

  return {
    temp,
    feelsLike: Math.round(current.apparent_temperature),
    humidity: current.relative_humidity_2m ?? 0,
    precipProb: current.precipitation_probability ?? 0,
    weatherCode: current.weather_code,
    isDay: current.is_day === 1,
    condition,
    suggestion: getSuggestion(temp, current.precipitation_probability ?? 0, condition),
  };
}

export async function getLocationAndWeather(): Promise<WeatherData | null> {
  try {
    if (typeof window === 'undefined' || !navigator.geolocation) return null;

    const position = await new Promise<GeolocationPosition>((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        timeout: 8000,
        maximumAge: 300000,
        enableHighAccuracy: false,
      });
    });

    return await fetchWeather(
      position.coords.latitude,
      position.coords.longitude
    );
  } catch {
    return null;
  }
}
