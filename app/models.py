from pydantic import BaseModel
from datetime import date


class Plan(BaseModel):
    destination: str
    start_date: date
    end_date: date
    base_currency: str = "INR"
    amount: float = 1.0

class WeatherResponse(BaseModel):
    date: str
    condition: str
    temperature_high: float
    temperature_low: float
    humidity: int
    rain_chance: float

class PlaceModel(BaseModel):
    name: str
    description: str
    category: str
    rating: float
    estimated_visit_duration: float  # in minutes
    entry_fee: float  # in base currency