"use client";

import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  CalendarDays,
  Check,
  CloudSun,
  Compass,
  Droplets,
  LoaderCircle,
  MapPin,
  Plane,
  Radio,
  Sparkles,
  Star,
  Sun,
  Waves,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import type {
  PlanRequest,
  PlanResponse,
  PlanSource,
  Place,
  WeatherDay,
} from "@/lib/plan-types";

type PlanMode = "standard" | "stream";
type SourceStatus = "idle" | "loading" | "complete" | "error";
type SourceStatuses = Record<PlanSource, SourceStatus>;

interface BackendInfo {
  message: string;
  version: string;
  description: string;
  "API endpoints"?: Record<string, string>;
}

interface CacheStats {
  entries: number;
}

const initialSourceStatuses: SourceStatuses = {
  weather: "idle",
  places: "idle",
  currency: "idle",
};

function formatLocalDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatMoney(value: number, currency: string) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatWeatherDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00Z`));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

async function getErrorMessage(response: Response) {
  const body = await response.text();
  if (!body) {
    return `Request failed (${response.status}).`;
  }

  try {
    const payload: unknown = JSON.parse(body);
    if (isRecord(payload) && typeof payload.detail === "string") {
      return payload.detail;
    }
    return body;
  } catch (error) {
    if (error instanceof SyntaxError) {
      return body;
    }
    throw error;
  }
}

function parseSseFrame(frame: string) {
  let event = "message";
  const data: string[] = [];

  for (const line of frame.split("\n")) {
    if (!line || line.startsWith(":")) {
      continue;
    }

    if (line.startsWith("event:")) {
      event = line.slice(6).trim();
    } else if (line.startsWith("data:")) {
      data.push(line.slice(5).trimStart());
    }
  }

  if (data.length === 0) {
    return null;
  }

  try {
    const payload: unknown = JSON.parse(data.join("\n"));
    return { event, payload };
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error("The streaming API returned invalid event data.");
    }
    throw error;
  }
}

function PlaceCard({
  place,
  currency,
}: {
  place: Place;
  currency: string;
}) {
  return (
    <article className="flex flex-col justify-between gap-5 rounded-2xl border border-[#e9ede5] bg-white p-5 transition hover:-translate-y-0.5 hover:shadow-md">
      <div>
        <div className="mb-4 flex items-center justify-between gap-3">
          <span className="rounded-full bg-[#f0f5ed] px-3 py-1 text-xs font-semibold text-[#527257]">
            {place.category}
          </span>
          <span className="inline-flex items-center gap-1 text-sm font-semibold text-[#8a682e]">
            <Star size={14} fill="currentColor" />
            {place.rating.toFixed(1)}
          </span>
        </div>
        <h4 className="text-lg font-semibold tracking-tight text-[#23372b]">
          {place.name}
        </h4>
        <p className="mt-2 text-sm leading-6 text-[#768078]">
          {place.description}
        </p>
      </div>
      <div className="flex items-center justify-between border-t border-[#edf0eb] pt-4 text-xs font-medium text-[#788179]">
        <span>{Math.round(place.estimated_visit_duration / 60)} hr visit</span>
        <span>{formatMoney(place.entry_fee, currency)}</span>
      </div>
    </article>
  );
}

function LoadingLine() {
  return (
    <div className="flex items-center gap-2 py-6 text-sm font-medium text-[#788179]">
      <LoaderCircle className="animate-spin text-[#53865f]" size={17} />
      Gathering this part of your plan…
    </div>
  );
}

export default function Home() {
  const [destination, setDestination] = useState("Goa");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [baseCurrency, setBaseCurrency] = useState("INR");
  const [amount, setAmount] = useState("10000");
  const [mode, setMode] = useState<PlanMode>("standard");
  const [isLoading, setIsLoading] = useState(false);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [planResult, setPlanResult] = useState<Partial<PlanResponse> | null>(
    null,
  );
  const [submittedPlan, setSubmittedPlan] = useState<PlanRequest | null>(null);
  const [sourceStatuses, setSourceStatuses] =
    useState<SourceStatuses>(initialSourceStatuses);
  const [backendInfo, setBackendInfo] = useState<BackendInfo | null>(null);
  const [backendError, setBackendError] = useState<string | null>(null);
  const [cacheStats, setCacheStats] = useState<CacheStats | null>(null);
  const [cacheError, setCacheError] = useState<string | null>(null);
  const [cacheMessage, setCacheMessage] = useState<string | null>(null);
  const [cacheLoading, setCacheLoading] = useState(true);
  const [cacheClearing, setCacheClearing] = useState(false);

  const loadBackendInfo = useCallback(async () => {
    try {
      const response = await fetch("/api/backend", { cache: "no-store" });
      if (!response.ok) {
        throw new Error(await getErrorMessage(response));
      }

      const info = (await response.json()) as BackendInfo;
      setBackendInfo(info);
      setBackendError(null);
    } catch (error) {
      setBackendInfo(null);
      setBackendError(
        error instanceof Error ? error.message : "The Yatra API is unavailable.",
      );
    }
  }, []);

  const refreshCacheStats = useCallback(async (showLoading = true) => {
    if (showLoading) {
      setCacheLoading(true);
    }

    try {
      const response = await fetch("/api/plan/cache-stats", {
        cache: "no-store",
      });
      if (!response.ok) {
        throw new Error(await getErrorMessage(response));
      }

      const stats = (await response.json()) as CacheStats;
      setCacheStats(stats);
      setCacheError(null);
    } catch (error) {
      setCacheStats(null);
      setCacheError(
        error instanceof Error
          ? error.message
          : "Unable to load cache statistics.",
      );
    } finally {
      setCacheLoading(false);
    }
  }, []);

  const clearPlanCache = useCallback(async () => {
    setCacheClearing(true);
    setCacheMessage(null);
    setCacheError(null);

    try {
      const response = await fetch("/api/plan", { method: "DELETE" });
      if (!response.ok) {
        throw new Error(await getErrorMessage(response));
      }

      const result: unknown = await response.json();
      const message =
        isRecord(result) && typeof result.message === "string"
          ? result.message
          : "Travel plan cache cleared.";
      setCacheMessage(message);
      await refreshCacheStats(false);
    } catch (error) {
      setCacheError(
        error instanceof Error ? error.message : "Unable to clear the cache.",
      );
    } finally {
      setCacheClearing(false);
    }
  }, [refreshCacheStats]);

  useEffect(() => {
    let active = true;

    fetch("/api/backend", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(await getErrorMessage(response));
        }
        return (await response.json()) as BackendInfo;
      })
      .then((info) => {
        if (active) {
          setBackendInfo(info);
          setBackendError(null);
        }
      })
      .catch((error: unknown) => {
        if (active) {
          setBackendInfo(null);
          setBackendError(
            error instanceof Error
              ? error.message
              : "The Yatra API is unavailable.",
          );
        }
      });

    fetch("/api/plan/cache-stats", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(await getErrorMessage(response));
        }
        return (await response.json()) as CacheStats;
      })
      .then((stats) => {
        if (active) {
          setCacheStats(stats);
          setCacheError(null);
        }
      })
      .catch((error: unknown) => {
        if (active) {
          setCacheStats(null);
          setCacheError(
            error instanceof Error
              ? error.message
              : "Unable to load cache statistics.",
          );
        }
      })
      .finally(() => {
        if (active) {
          setCacheLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  async function submitPlan(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setRequestError(null);
    setPlanResult(null);

    const today = formatLocalDate(new Date());
    if (startDate < today) {
      setRequestError("Choose a start date that is today or later.");
      return;
    }

    const durationDays =
      (Date.parse(`${endDate}T00:00:00Z`) -
        Date.parse(`${startDate}T00:00:00Z`)) /
      86_400_000;
    if (durationDays < 1) {
      setRequestError("Your end date must be at least one day after the start.");
      return;
    }
    if (durationDays > 30) {
      setRequestError("Trips can be up to 30 days long.");
      return;
    }

    const request: PlanRequest = {
      destination: destination.trim(),
      start_date: startDate,
      end_date: endDate,
      base_currency: baseCurrency,
      amount: Number(amount),
    };

    setSubmittedPlan(request);
    setPlanResult({
      destination: request.destination,
      duration_days: durationDays,
      weather: null,
      places: null,
      currency: null,
      errors: null,
    });
    setSourceStatuses({
      weather: "loading",
      places: "loading",
      currency: "loading",
    });
    setIsLoading(true);

    try {
      if (mode === "standard") {
        const response = await fetch("/api/plan", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(request),
        });
        if (!response.ok) {
          throw new Error(await getErrorMessage(response));
        }

        const data = (await response.json()) as PlanResponse;
        setPlanResult(data);
        setSourceStatuses({
          weather: data.weather ? "complete" : data.errors?.weather ? "error" : "complete",
          places: data.places ? "complete" : data.errors?.places ? "error" : "complete",
          currency: data.currency != null ? "complete" : data.errors?.currency ? "error" : "complete",
        });
      } else {
        await streamPlan(request, durationDays);
      }
    } catch (error) {
      setRequestError(
        error instanceof Error
          ? error.message
          : "Something went wrong while creating your plan.",
      );
      setSourceStatuses({
        weather: "error",
        places: "error",
        currency: "error",
      });
    } finally {
      setIsLoading(false);
    }
  }

  async function streamPlan(request: PlanRequest, durationDays: number) {
    const response = await fetch("/api/plan/stream", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
    });
    if (!response.ok) {
      throw new Error(await getErrorMessage(response));
    }
    if (!response.body) {
      throw new Error("The streaming API did not return a readable response.");
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let receivedComplete = false;
    let receivedStreamError = false;

    const handleEvent = (event: string, payload: unknown) => {
      if (!isRecord(payload)) {
        return;
      }

      if (event === "update") {
        const source = payload.source;
        if (source === "weather" && Array.isArray(payload.data)) {
          setPlanResult((current) => ({
            ...current,
            weather: payload.data as WeatherDay[],
          }));
          setSourceStatuses((current) => ({ ...current, weather: "complete" }));
        } else if (source === "places" && Array.isArray(payload.data)) {
          setPlanResult((current) => ({
            ...current,
            places: payload.data as Place[],
          }));
          setSourceStatuses((current) => ({ ...current, places: "complete" }));
        } else if (source === "currency" && typeof payload.data === "number") {
          const currency = payload.data;
          setPlanResult((current) => ({
            ...current,
            currency,
          }));
          setSourceStatuses((current) => ({ ...current, currency: "complete" }));
        }
      } else if (event === "source_error") {
        const source = payload.source;
        const message =
          typeof payload.error === "string"
            ? payload.error
            : "This data source could not be loaded.";
        if (
          source === "weather" ||
          source === "places" ||
          source === "currency"
        ) {
          setPlanResult((current) => ({
            ...current,
            errors: { ...current?.errors, [source]: message },
          }));
          setSourceStatuses((current) => ({ ...current, [source]: "error" }));
        }
      } else if (event === "stream_error") {
        receivedStreamError = true;
        setRequestError(
          typeof payload.message === "string"
            ? payload.message
            : "All travel data sources failed.",
        );
      } else if (event === "complete") {
        receivedComplete = true;
      }
    };

    const consumeFrame = (frame: string) => {
      const parsed = parseSseFrame(frame);
      if (parsed) {
        handleEvent(parsed.event, parsed.payload);
      }
    };

    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }

      buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, "\n");
      let boundary = buffer.indexOf("\n\n");
      while (boundary !== -1) {
        consumeFrame(buffer.slice(0, boundary));
        buffer = buffer.slice(boundary + 2);
        boundary = buffer.indexOf("\n\n");
      }
    }

    buffer += decoder.decode().replace(/\r\n/g, "\n");
    if (buffer.trim()) {
      consumeFrame(buffer);
    }

    if (!receivedComplete && !receivedStreamError) {
      throw new Error("The plan stream ended before it was complete.");
    }

    setPlanResult((current) => ({
      ...current,
      destination: request.destination,
      duration_days: durationDays,
    }));
  }

  const isStreamMode = mode === "stream";
  const hasResult = planResult !== null;

  return (
    <main className="min-h-screen bg-[#f6f7f1] text-[#24352a]">
      <div className="mx-auto max-w-7xl px-5 pb-16 sm:px-8">
        <header className="flex items-center justify-between border-b border-[#e7ebe2] py-5">
          <a href="#" className="flex items-center gap-2.5" aria-label="Yatra home">
            <span className="grid size-10 place-items-center rounded-2xl bg-[#315d3b] text-white shadow-sm">
              <Compass size={21} />
            </span>
            <span className="text-xl font-bold tracking-tight text-[#24412d]">
              yatra<span className="text-[#80a77b]">.</span>
            </span>
          </a>
          <div
            className="hidden items-center gap-2 rounded-full border border-[#e4e9df] bg-white/80 px-4 py-2 text-xs font-medium text-[#69776a] sm:flex"
            title={backendError ?? undefined}
          >
            <span
              className={`size-2 rounded-full ${
                backendInfo
                  ? "bg-[#81a978]"
                  : backendError
                    ? "bg-[#c8765e]"
                    : "animate-pulse bg-[#d2aa57]"
              }`}
            />
            {backendInfo
              ? `Yatra API v${backendInfo.version}`
              : backendError
                ? "API connection unavailable"
                : "Connecting to Yatra API"}
          </div>
          <span className="inline-flex items-center gap-2 rounded-full bg-[#e8efe4] px-3 py-2 text-xs font-semibold text-[#456b4b]">
            <Sparkles size={14} />
            Start exploring
          </span>
        </header>

        <section className="grid gap-8 pb-9 pt-10 md:grid-cols-[1.3fr_0.7fr] md:items-end md:pb-12 md:pt-14">
          <div>
            <p className="mb-4 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-[#68836a]">
              <Waves size={15} />
              A clearer way to get away
            </p>
            <h1 className="max-w-3xl text-4xl font-semibold leading-[1.1] tracking-[-0.045em] text-[#243b2c] sm:text-5xl md:text-6xl">
              Less searching.
              <br />
              <span className="font-serif font-medium italic text-[#618165]">
                More somewhere.
              </span>
            </h1>
            <p className="mt-5 max-w-xl text-base leading-7 text-[#738076] sm:text-lg">
              Pick a place and dates. We’ll bring together the weather, local
              spots, and a little currency clarity for the road ahead.
            </p>
          </div>
          <div className="hidden rounded-3xl border border-[#e6eadf] bg-white/70 p-5 md:block">
            <div className="mb-4 flex size-11 items-center justify-center rounded-2xl bg-[#eff4e9] text-[#597e5c]">
              <Plane size={20} />
            </div>
            <p className="text-sm font-semibold text-[#334a38]">
              Your trip starts with one good idea.
            </p>
            <p className="mt-1 text-sm leading-6 text-[#828b80]">
              From a weekend by the sea to a longer change of scene.
            </p>
          </div>
        </section>

        <section
          id="planner"
          className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(290px,0.6fr)]"
        >
          <div className="rounded-[2rem] border border-[#e9ede5] bg-white p-5 shadow-[0_16px_50px_-36px_rgba(47,73,48,0.4)] sm:p-8">
            <div className="mb-7 flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.17em] text-[#7b9277]">
                  The good part begins here
                </p>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight text-[#263d2e]">
                  Plan your next trip
                </h2>
              </div>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[#f3f6f0] px-3 py-1.5 text-xs font-medium text-[#718071]">
                <Compass size={13} />
                1–30 days
              </span>
            </div>

            <form onSubmit={submitPlan} className="space-y-5">
              <div>
                <label
                  htmlFor="destination"
                  className="mb-2 block text-sm font-semibold text-[#435246]"
                >
                  Where would you like to go?
                </label>
                <div className="relative">
                  <MapPin
                    className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#87a083]"
                    size={18}
                  />
                  <input
                    id="destination"
                    name="destination"
                    list="popular-destinations"
                    value={destination}
                    onChange={(event) => setDestination(event.target.value)}
                    placeholder="Try Goa, Jaipur, or somewhere new"
                    required
                    className="h-13 w-full rounded-2xl border border-[#e3e9df] bg-[#fbfcf9] pl-11 pr-4 text-sm text-[#304234] outline-none transition placeholder:text-[#a0a9a0] focus:border-[#7fa27b] focus:ring-4 focus:ring-[#eaf1e6]"
                  />
                  <datalist id="popular-destinations">
                    <option value="Goa" />
                    <option value="Bangalore" />
                    <option value="Jaipur" />
                    <option value="Delhi" />
                    <option value="Mumbai" />
                    <option value="Kolkata" />
                    <option value="Chennai" />
                  </datalist>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="start-date"
                    className="mb-2 block text-sm font-semibold text-[#435246]"
                  >
                    Leaving
                  </label>
                  <div className="relative">
                    <CalendarDays
                      className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#87a083]"
                      size={17}
                    />
                    <input
                      id="start-date"
                      type="date"
                      value={startDate}
                      onChange={(event) => setStartDate(event.target.value)}
                      required
                      className="h-13 w-full rounded-2xl border border-[#e3e9df] bg-[#fbfcf9] pl-11 pr-3 text-sm text-[#435246] outline-none transition focus:border-[#7fa27b] focus:ring-4 focus:ring-[#eaf1e6]"
                    />
                  </div>
                </div>
                <div>
                  <label
                    htmlFor="end-date"
                    className="mb-2 block text-sm font-semibold text-[#435246]"
                  >
                    Returning
                  </label>
                  <div className="relative">
                    <CalendarDays
                      className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#87a083]"
                      size={17}
                    />
                    <input
                      id="end-date"
                      type="date"
                      value={endDate}
                      min={startDate || undefined}
                      onChange={(event) => setEndDate(event.target.value)}
                      required
                      className="h-13 w-full rounded-2xl border border-[#e3e9df] bg-[#fbfcf9] pl-11 pr-3 text-sm text-[#435246] outline-none transition focus:border-[#7fa27b] focus:ring-4 focus:ring-[#eaf1e6]"
                    />
                  </div>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="currency"
                    className="mb-2 block text-sm font-semibold text-[#435246]"
                  >
                    Your currency
                  </label>
                  <select
                    id="currency"
                    value={baseCurrency}
                    onChange={(event) => setBaseCurrency(event.target.value)}
                    className="h-13 w-full rounded-2xl border border-[#e3e9df] bg-[#fbfcf9] px-4 text-sm text-[#435246] outline-none transition focus:border-[#7fa27b] focus:ring-4 focus:ring-[#eaf1e6]"
                  >
                    <option value="INR">INR · Indian Rupee</option>
                    <option value="USD">USD · US Dollar</option>
                    <option value="EUR">EUR · Euro</option>
                    <option value="GBP">GBP · British Pound</option>
                    <option value="AED">AED · UAE Dirham</option>
                    <option value="JPY">JPY · Japanese Yen</option>
                  </select>
                </div>
                <div>
                  <label
                    htmlFor="amount"
                    className="mb-2 block text-sm font-semibold text-[#435246]"
                  >
                    Amount to convert
                  </label>
                  <input
                    id="amount"
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={amount}
                    onChange={(event) => setAmount(event.target.value)}
                    required
                    className="h-13 w-full rounded-2xl border border-[#e3e9df] bg-[#fbfcf9] px-4 text-sm text-[#435246] outline-none transition focus:border-[#7fa27b] focus:ring-4 focus:ring-[#eaf1e6]"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-3 border-t border-[#edf0eb] pt-5 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <span className="mb-2 block text-xs font-bold uppercase tracking-[0.14em] text-[#899287]">
                    How should we gather your plan?
                  </span>
                  <div className="inline-flex rounded-xl bg-[#f2f5ef] p-1">
                    <button
                      type="button"
                      aria-pressed={mode === "standard"}
                      onClick={() => setMode("standard")}
                      className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold transition ${
                        mode === "standard"
                          ? "bg-white text-[#315d3b] shadow-sm"
                          : "text-[#7f897e] hover:text-[#47654a]"
                      }`}
                    >
                      <Check size={14} />
                      All at once
                    </button>
                    <button
                      type="button"
                      aria-pressed={mode === "stream"}
                      onClick={() => setMode("stream")}
                      className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold transition ${
                        mode === "stream"
                          ? "bg-white text-[#315d3b] shadow-sm"
                          : "text-[#7f897e] hover:text-[#47654a]"
                      }`}
                    >
                      <Radio size={14} />
                      As it arrives
                    </button>
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-[#315d3b] px-6 text-sm font-semibold text-white shadow-[0_8px_20px_-10px_rgba(49,93,59,0.8)] transition hover:bg-[#244b2e] disabled:cursor-wait disabled:opacity-70 sm:min-w-48"
                >
                  {isLoading ? (
                    <>
                      <LoaderCircle className="animate-spin" size={17} />
                      Putting it together
                    </>
                  ) : (
                    <>
                      Find my way
                      <ArrowRight size={17} />
                    </>
                  )}
                </button>
              </div>
              <p className="text-xs leading-5 text-[#929a90]">
                {isStreamMode
                  ? "Your weather, places, and currency will appear as each source responds."
                  : "We’ll gather your weather, places, and currency in one go."}
              </p>
            </form>

            {requestError && (
              <div
                role="alert"
                className="mt-5 rounded-2xl border border-[#f1d8ce] bg-[#fff7f3] px-4 py-3 text-sm leading-6 text-[#a54c37]"
              >
                {requestError}
              </div>
            )}
          </div>

          <aside className="flex flex-col justify-between overflow-hidden rounded-[2rem] bg-[#315d3b] p-6 text-white sm:p-8">
            <div className="relative">
              <div className="absolute -right-14 -top-16 size-48 rounded-full border border-white/10" />
              <div className="absolute -right-4 -top-6 size-28 rounded-full border border-white/10" />
              <div className="relative mb-10 flex size-12 items-center justify-center rounded-2xl bg-white/10">
                <Sun size={22} />
              </div>
              <p className="relative text-xs font-bold uppercase tracking-[0.18em] text-[#c5d6bd]">
                A little more prepared
              </p>
              <h3 className="relative mt-3 max-w-xs text-3xl font-semibold leading-tight tracking-[-0.035em]">
                Good trips leave room for wonder.
              </h3>
              <p className="relative mt-4 text-sm leading-6 text-[#d3dfd0]">
                Get a feel for the forecast, find places worth a detour, and
                check a conversion before you go.
              </p>
            </div>
            <div className="mt-10 space-y-3">
              <div className="flex items-center gap-3 rounded-2xl bg-white/[0.08] px-4 py-3">
                <CloudSun className="shrink-0 text-[#d9e8c7]" size={18} />
                <span className="text-sm text-[#eef3e9]">A forecast for your dates</span>
                <ArrowRight className="ml-auto text-[#bdd0b4]" size={16} />
              </div>
              <div className="flex items-center gap-3 rounded-2xl bg-white/[0.08] px-4 py-3">
                <MapPin className="shrink-0 text-[#d9e8c7]" size={18} />
                <span className="text-sm text-[#eef3e9]">Local spots to explore</span>
                <ArrowRight className="ml-auto text-[#bdd0b4]" size={16} />
              </div>
              <div className="flex items-center gap-3 rounded-2xl bg-white/[0.08] px-4 py-3">
                <Compass className="shrink-0 text-[#d9e8c7]" size={18} />
                <span className="text-sm text-[#eef3e9]">Currency, at a glance</span>
                <ArrowRight className="ml-auto text-[#bdd0b4]" size={16} />
              </div>
            </div>
          </aside>
        </section>

        <section className="mt-8" aria-live="polite">
          {hasResult ? (
            <div className="space-y-5">
              <div className="flex flex-wrap items-end justify-between gap-3 px-1">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.17em] text-[#7b9277]">
                    Your trip, taking shape
                  </p>
                  <h2 className="mt-1 text-2xl font-semibold tracking-tight text-[#263d2e]">
                    {planResult.destination ?? submittedPlan?.destination}
                  </h2>
                </div>
                <span className="rounded-full border border-[#e3e9df] bg-white px-3 py-1.5 text-sm font-medium text-[#6d7b6e]">
                  {planResult.duration_days ?? 0} days away
                </span>
              </div>

              <div className="grid gap-5 md:grid-cols-2">
                <section className="rounded-3xl border border-[#e9ede5] bg-white p-5 shadow-sm sm:p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="grid size-10 place-items-center rounded-2xl bg-[#eff4e9] text-[#567c5a]">
                        <CloudSun size={19} />
                      </span>
                      <div>
                        <h3 className="font-semibold text-[#334a38]">Weather outlook</h3>
                        <p className="text-xs text-[#8a9388]">A day-by-day first look</p>
                      </div>
                    </div>
                    <StatusLabel status={sourceStatuses.weather} />
                  </div>

                  {sourceStatuses.weather === "loading" ? (
                    <LoadingLine />
                  ) : sourceStatuses.weather === "error" ? (
                    <SourceError message={planResult.errors?.weather} />
                  ) : planResult.weather?.length ? (
                    <div className="mt-5 space-y-2">
                      {planResult.weather.map((day) => (
                        <WeatherRow key={day.date} day={day} />
                      ))}
                    </div>
                  ) : (
                    <p className="py-6 text-sm text-[#8a9388]">
                      No weather details were returned for these dates.
                    </p>
                  )}
                </section>

                <section className="rounded-3xl border border-[#e9ede5] bg-white p-5 shadow-sm sm:p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="grid size-10 place-items-center rounded-2xl bg-[#f8f2e7] text-[#a17d40]">
                        <ArrowRight size={19} />
                      </span>
                      <div>
                        <h3 className="font-semibold text-[#334a38]">Currency check</h3>
                        <p className="text-xs text-[#8a9388]">Your amount, converted to USD</p>
                      </div>
                    </div>
                    <StatusLabel status={sourceStatuses.currency} />
                  </div>

                  {sourceStatuses.currency === "loading" ? (
                    <LoadingLine />
                  ) : sourceStatuses.currency === "error" ? (
                    <SourceError message={planResult.errors?.currency} />
                  ) : planResult.currency != null ? (
                    <div className="mt-6 rounded-2xl bg-[#f7f8f2] p-5">
                      <p className="text-xs font-medium text-[#899287]">
                        {formatMoney(submittedPlan?.amount ?? 0, submittedPlan?.base_currency ?? "INR")}
                      </p>
                      <div className="my-3 flex items-center gap-3 text-[#7d8c7d]">
                        <span className="h-px flex-1 bg-[#e3e9df]" />
                        <ArrowDown size={16} />
                        <span className="h-px flex-1 bg-[#e3e9df]" />
                      </div>
                      <p className="text-3xl font-semibold tracking-tight text-[#315d3b]">
                        {formatMoney(planResult.currency, "USD")}
                      </p>
                      <p className="mt-2 text-xs text-[#899287]">
                        Indicative conversion · rates may change
                      </p>
                    </div>
                  ) : (
                    <p className="py-6 text-sm text-[#8a9388]">
                      No conversion was returned for this amount.
                    </p>
                  )}
                </section>
              </div>

              <section className="rounded-3xl border border-[#e9ede5] bg-white p-5 shadow-sm sm:p-6">
                <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="grid size-10 place-items-center rounded-2xl bg-[#edf3f1] text-[#527e75]">
                      <MapPin size={19} />
                    </span>
                    <div>
                      <h3 className="font-semibold text-[#334a38]">Worth a wander</h3>
                      <p className="text-xs text-[#8a9388]">Places to make the trip yours</p>
                    </div>
                  </div>
                  <StatusLabel status={sourceStatuses.places} />
                </div>

                {sourceStatuses.places === "loading" ? (
                  <LoadingLine />
                ) : sourceStatuses.places === "error" ? (
                  <SourceError message={planResult.errors?.places} />
                ) : planResult.places?.length ? (
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {planResult.places.map((place) => (
                      <PlaceCard
                        key={place.name}
                        place={place}
                        currency={submittedPlan?.base_currency ?? "INR"}
                      />
                    ))}
                  </div>
                ) : (
                  <p className="py-4 text-sm text-[#8a9388]">
                    No places were found for this destination yet.
                  </p>
                )}
              </section>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-[#dce4d8] bg-white/55 px-6 py-10 text-center">
              <span className="mb-3 grid size-11 place-items-center rounded-2xl bg-[#eaf1e6] text-[#648667]">
                <Plane size={20} />
              </span>
              <h2 className="font-semibold text-[#405744]">
                Your travel notes will show up here
              </h2>
              <p className="mt-1 max-w-md text-sm leading-6 text-[#8a9388]">
                Fill in the details above and we’ll bring the useful bits of your
                trip together.
              </p>
            </div>
          )}
        </section>

        <section className="mt-8 grid gap-5 rounded-3xl border border-[#e9ede5] bg-white p-5 shadow-sm sm:p-6 lg:grid-cols-[1fr_1fr]">
          <div>
            <div className="flex items-center gap-3">
              <span className="grid size-10 place-items-center rounded-2xl bg-[#eff4e9] text-[#567c5a]">
                <Compass size={19} />
              </span>
              <div>
                <h2 className="font-semibold text-[#334a38]">Backend API</h2>
                <p className="text-xs text-[#8a9388]">
                  {backendInfo
                    ? `Connected · version ${backendInfo.version}`
                    : backendError ?? "Checking the FastAPI service…"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => void loadBackendInfo()}
                className="ml-auto rounded-xl border border-[#e3e9df] px-3 py-2 text-xs font-semibold text-[#56765a] transition hover:bg-[#f5f8f2]"
              >
                Check connection
              </button>
            </div>
            {backendInfo?.description && (
              <p className="mt-4 text-sm leading-6 text-[#788378]">
                {backendInfo.description}
              </p>
            )}
            {backendInfo?.["API endpoints"] && (
              <ul className="mt-4 grid gap-2 text-xs text-[#748074] sm:grid-cols-2">
                {Object.entries(backendInfo["API endpoints"]).map(
                  ([endpoint, description]) => (
                    <li
                      key={endpoint}
                      className="rounded-xl bg-[#f7f8f4] px-3 py-2"
                      title={description}
                    >
                      <span className="font-mono font-semibold text-[#49694d]">
                        {endpoint}
                      </span>
                      <span className="ml-2">{description}</span>
                    </li>
                  ),
                )}
              </ul>
            )}
          </div>

          <div className="rounded-2xl bg-[#f7f8f4] p-4 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="font-semibold text-[#334a38]">Travel data cache</h3>
                <p className="mt-1 text-sm text-[#788378]">
                  {cacheLoading
                    ? "Loading cache statistics…"
                    : cacheStats
                      ? `${cacheStats.entries} active ${
                          cacheStats.entries === 1 ? "entry" : "entries"
                        }`
                      : "Cache statistics unavailable"}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => void refreshCacheStats()}
                  disabled={cacheLoading || cacheClearing}
                  className="rounded-xl border border-[#dfe6dc] bg-white px-3 py-2 text-xs font-semibold text-[#56765a] transition hover:bg-[#f0f5ed] disabled:opacity-60"
                >
                  Refresh
                </button>
                <button
                  type="button"
                  onClick={() => void clearPlanCache()}
                  disabled={cacheClearing}
                  className="rounded-xl bg-[#315d3b] px-3 py-2 text-xs font-semibold text-white transition hover:bg-[#244b2e] disabled:opacity-60"
                >
                  {cacheClearing ? "Clearing…" : "Clear cache"}
                </button>
              </div>
            </div>
            {cacheError && (
              <p role="alert" className="mt-3 text-xs leading-5 text-[#a45a44]">
                {cacheError}
              </p>
            )}
            {cacheMessage && (
              <p role="status" className="mt-3 text-xs leading-5 text-[#53785a]">
                {cacheMessage}
              </p>
            )}
          </div>
        </section>

        <footer className="flex flex-col items-center justify-between gap-2 pt-10 text-xs text-[#929a90] sm:flex-row">
          <span>Made for the joy of getting there.</span>
          <span>Powered by your Yatra Planner API</span>
        </footer>
      </div>
    </main>
  );
}

function StatusLabel({ status }: { status: SourceStatus }) {
  if (status === "loading") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-[#f1f5ee] px-2.5 py-1 text-[11px] font-semibold text-[#69836a]">
        <LoaderCircle className="animate-spin" size={12} />
        Loading
      </span>
    );
  }
  if (status === "error") {
    return (
      <span className="rounded-full bg-[#fff2eb] px-2.5 py-1 text-[11px] font-semibold text-[#a65f46]">
        Unavailable
      </span>
    );
  }
  if (status === "complete") {
    return (
      <span className="rounded-full bg-[#edf5eb] px-2.5 py-1 text-[11px] font-semibold text-[#53785a]">
        Ready
      </span>
    );
  }
  return null;
}

function SourceError({ message }: { message?: string }) {
  return (
    <p className="my-5 rounded-xl bg-[#fff7f3] px-4 py-3 text-sm leading-6 text-[#a45a44]">
      {message ?? "This data source could not be loaded."}
    </p>
  );
}

function WeatherRow({ day }: { day: WeatherDay }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-[#f8f9f5] px-3 py-3">
      <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-white text-[#728c68]">
        <Sun size={17} />
      </span>
      <span className="min-w-[4.25rem] text-xs font-semibold text-[#657466]">
        {formatWeatherDate(day.date)}
      </span>
      <span className="min-w-0 flex-1 truncate text-sm text-[#718074]">
        {day.condition}
      </span>
      <span className="flex items-center gap-1 text-xs text-[#667468]">
        <ArrowUp size={12} className="text-[#ce9660]" />
        {Math.round(day.temperature_high)}°
      </span>
      <span className="flex items-center gap-1 text-xs text-[#8b948b]">
        <ArrowDown size={12} />
        {Math.round(day.temperature_low)}°
      </span>
      <span className="hidden items-center gap-1 text-xs text-[#7a8a82] sm:flex">
        <Droplets size={12} />
        {Math.round(day.rain_chance)}%
      </span>
    </div>
  );
}
