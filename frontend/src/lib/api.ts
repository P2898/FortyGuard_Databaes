const BASE = import.meta.env.DEV ? '/api' : 'https://shade-api-gbyb.onrender.com/api';

async function fetchJSON<T>(url: string, options?: RequestInit): Promise<T> {
  const headers: Record<string, string> = {};
  if (!(options?.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }
  const res = await fetch(`${BASE}${url}`, { headers, ...options });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || 'Request failed');
  }
  return res.json();
}

async function fetchBlob(url: string, options?: RequestInit): Promise<Blob> {
  const headers: Record<string, string> = {};
  if (!(options?.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }
  const res = await fetch(`${BASE}${url}`, { headers, ...options });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || 'Request failed');
  }
  return res.blob();
}

// Types
export interface Site {
  site_id: string;
  name: string;
  latitude: number;
  longitude: number;
  site_type: string;
  created_at: string;
}

export interface Assessment {
  site_id: string;
  name: string;
  latitude: number;
  longitude: number;
  site_type: string;
  temperature_c: number;
  heat_index: number;
  risk_bucket: string;
  risk_color: string;
  threshold_label: string;
  threshold_source: string;
  exceedance_hours: number;
  persistence_hours: number;
  recommendation: string;
  response_time_ms: number;
}

export interface HeatPL {
  total_cost: number;
  lines: {
    label: string;
    amount: number;
    formula: string;
    inputs: Record<string, any>;
    disclaimer: string;
  }[];
  date: string;
  site_count: number;
}

export interface Policy {
  hazard_pay_rate_per_hr: number;
  wage_rate_per_hr: number;
  contract_day_rate: number;
}

export interface SiteDetail {
  site: Site;
  hourly_temps: number[];
  env_params: Record<string, any>;
  risk: Record<string, any>;
  stats: { min: number; max: number; avg: number };
}

export interface KelvinResponse {
  intent: string;
  response: string;
  data: Record<string, any>;
  confidence: number;
}

// Sites
export const getSites = () => fetchJSON<Site[]>('/sites');
export const createSite = (site: Partial<Site>) => fetchJSON<Site>('/sites', { method: 'POST', body: JSON.stringify(site) });
export const uploadCSV = async (csvText: string) => {
  const blob = new Blob([csvText], { type: 'text/csv' });
  const form = new FormData();
  form.append('file', blob, 'sites.csv');
  return fetchJSON<Site[]>('/sites/upload', { method: 'POST', body: form });
};
export const deleteSite = (id: string) => fetchJSON<any>(`/sites/${id}`, { method: 'DELETE' });

// Assessment
export const assessFleet = (req: any = {}) => fetchJSON<{ sites: Assessment[]; stats: any; assessed_at: string; response_time_ms: number; cached: boolean }>('/assessment/fleet', { method: 'POST', body: JSON.stringify({ site_ids: req.site_ids || [], ...req }) });
export const getSiteDetail = (id: string, date?: string) => fetchJSON<SiteDetail>(`/assessment/site/${id}${date ? `?date=${date}` : ''}`);

// Heat P&L
export const getHeatPL = (date?: string) => fetchJSON<HeatPL>(`/heat-pl${date ? `?date=${date}` : ''}`);
export const getPolicy = () => fetchJSON<Policy>('/heat-pl/policy');
export const updatePolicy = (policy: Partial<Policy>) => fetchJSON<any>('/heat-pl/policy', { method: 'PUT', body: JSON.stringify(policy) });

// Kelvin
export const askKelvin = (message: string) => fetchJSON<KelvinResponse>('/kelvin', { method: 'POST', body: JSON.stringify({ message }) });

// Routes
export interface RouteResult {
  origin: { name: string; lat: number; lon: number };
  destination: { name: string; lat: number; lon: number };
  fastest_route: { type: string; coordinates: number[][]; avg_temp_c: number };
  coolest_route: { type: string; coordinates: number[][]; avg_temp_c: number };
  temp_delta_f: number;
  temp_delta_c: number;
  time_delta_min: number;
  distance_km: number;
}

export interface RouteSite {
  site_id: string;
  name: string;
  latitude: number;
  longitude: number;
}

export const planRoute = (req: { origin_lat: number; origin_lon: number; dest_lat: number; dest_lon: number; origin_name?: string; dest_name?: string; travel_mode?: string }) =>
  fetchJSON<RouteResult>('/routes/plan', { method: 'POST', body: JSON.stringify(req) });

export const markRouteHelpful = (helpful: boolean) =>
  fetchJSON<any>('/routes/helpful', { method: 'POST', body: JSON.stringify({ helpful }) });

export const getRouteSites = () => fetchJSON<RouteSite[]>('/routes/sites');

// Reports
export const generateReport = async (req: { scope: string; site_id?: string }) => {
  const blob = await fetchBlob('/reports/generate', { method: 'POST', body: JSON.stringify(req) });
  return blob;
};

export const generateCSVReport = async (req: { scope: string; site_id?: string }) => {
  const blob = await fetchBlob('/reports/csv', { method: 'POST', body: JSON.stringify(req) });
  return blob;
};

// Street View heat data (pegman drop)
export interface HeatAtPoint {
  lat: number;
  lon: number;
  temperature_c: number;
  heat_index_c: number;
  humidity: number;
  solar_irradiance: number;
  aqi: number;
}

export const getHeatAtPoint = (lat: number, lon: number) =>
  fetchJSON<HeatAtPoint>(`/streetview/heat-data?lat=${lat.toFixed(6)}&lon=${lon.toFixed(6)}`);

// Config
export const getConfig = () => fetchJSON<any>('/config');

// AI Chat (RAG-powered)
export interface ChatMessage {
  answer: string;
  intent: string;
  confidence: number;
  sources: { id: string; title: string; score: number }[];
  suggestions: string[];
  agents_invoked: string[] | null;
  response_time_ms: number;
  navigate_to?: string;
  route_params?: { origin: string; destination: string };
}

export const sendChat = (message: string, useAgents = false) =>
  fetchJSON<ChatMessage>('/ai/chat', { method: 'POST', body: JSON.stringify({ message, use_agents: useAgents }) });

// Monitoring
export interface MonitoringMetrics {
  uptime_seconds: number;
  uptime_human: string;
  total_requests: number;
  error_count: number;
  error_rate_percent: number;
  avg_response_time_ms: number;
  p95_response_time_ms: number;
  cache: { hits: number; misses: number; hit_rate_percent: number };
  fortyguard: { total_calls: number; errors: number };
  supabase: { total_calls: number; errors: number };
  agents: Record<string, { calls: number; avg_latency_ms: number; max_latency_ms: number }>;
  operations: Record<string, { count: number; avg_ms: number }>;
  recent_alerts: { type: string; message: string; time_str: string }[];
  health: { status: string; issues: string[]; indicator: string };
}

export const getMetrics = () => fetchJSON<MonitoringMetrics>('/monitoring/metrics');
export const getHealth = () => fetchJSON<{ status: string; issues: string[]; indicator: string }>('/monitoring/health');

// Multi-Agent Analysis
export interface PortfolioAnalysis {
  risk: { summary: string; data: any; confidence: number };
  compliance: { summary: string; data: any; confidence: number };
  financial: { summary: string; data: any; confidence: number };
  recommendations: string[];
  agents_used: string[];
}

export const analyzePortfolio = () => fetchJSON<PortfolioAnalysis>('/ai/agents/portfolio', { method: 'POST' });

// Predictive Heat Forecast
export interface ForecastCheckpoint {
  hours_from_now: number;
  temp_c: number;
  heat_index_c: number;
  risk_bucket: string;
  risk_color: string;
  nws_band: string;
  nws_description: string;
  confidence: number;
  confidence_label: string;
  recommendation: string;
}

export interface SiteForecast {
  site_id: string;
  site_name: string;
  latitude: number;
  longitude: number;
  peak_temp_c: number;
  peak_heat_index_c: number;
  peak_risk_bucket: string;
  peak_hour: number;
  hours_above_osha: number;
  hours_above_danger: number;
  cost_of_inaction: number;
  reschedule_savings: number;
  reschedule_recommendation: string;
  overall_confidence: number;
  overall_confidence_label: string;
  checkpoints: ForecastCheckpoint[];
}

export interface PortfolioForecast {
  generated_at: string;
  forecast_horizon_hours: number;
  total_cost_of_inaction: number;
  total_reschedule_savings: number;
  critical_sites_count: number;
  high_sites_count: number;
  dollars_flagged_this_quarter: number;
  sites: SiteForecast[];
}

export interface ForecastAccuracy {
  total_forecasts: number;
  accuracy_percent: number;
  avg_temp_delta_c: number;
  risk_match_rate: number;
  period_days: number;
  message: string;
}

export interface DollarsFlagged {
  total_flagged: number;
  by_site: Record<string, number>;
  entry_count: number;
  quarter: string;
  message: string;
}

export const getPortfolioForecast = (siteIds: string[] = []) =>
  fetchJSON<PortfolioForecast>('/forecast/portfolio', { method: 'POST', body: JSON.stringify({ site_ids: siteIds }) });

export const getSiteForecast = (siteId: string) =>
  fetchJSON<SiteForecast>(`/forecast/site/${siteId}`);

export const getForecastAccuracy = (days: number = 30) =>
  fetchJSON<ForecastAccuracy>(`/forecast/accuracy?days=${days}`);

export const getDollarsFlagged = () =>
  fetchJSON<DollarsFlagged>('/forecast/dollars-flagged');

export const getNwsBands = () =>
  fetchJSON<any>('/forecast/nws-bands');

// Audio Transcription — with long timeout for Render cold starts
export const transcribeAudio = async (audioBlob: Blob) => {
  const url = `${BASE}/transcribe/audio`;
  const form = new FormData();
  form.append('audio', audioBlob, 'recording.webm');

  console.log(`[transcribe] Sending ${audioBlob.size} bytes to ${url}`);

  const res = await fetch(url, {
    method: 'POST',
    body: form,
    signal: AbortSignal.timeout(60000), // 60s for Render cold start
  });

  console.log(`[transcribe] Response: ${res.status}`);

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || `Server error ${res.status}`);
  }

  return res.json();
};
