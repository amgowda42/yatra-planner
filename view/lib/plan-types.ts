export type PlanSource = "weather" | "places" | "currency";

export interface WeatherDay {
  date: string;
  condition: string;
  temperature_high: number;
  temperature_low: number;
  humidity: number;
  rain_chance: number;
}

export interface Place {
  name: string;
  description: string;
  category: string;
  rating: number;
  estimated_visit_duration: number;
  entry_fee: number;
}

export interface PlanRequest {
  destination: string;
  start_date: string;
  end_date: string;
  base_currency: string;
  amount: number;
}

export interface PlanResponse {
  message: string;
  destination: string;
  duration_days: number;
  weather: WeatherDay[] | null;
  places: Place[] | null;
  currency: number | null;
  errors: Partial<Record<PlanSource, string>> | null;
}
