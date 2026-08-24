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
export const assessFleet = (req: any = {}) => fetchJSON<{ sites: Assessment[]; stats: any; assessed_at: string; response_time_ms: number; cached: boolean }>('/assessment/fleet', { method: 'POST', body: JSON.stringify(req) });
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

export const planRoute = (req: { origin_lat: number; origin_lon: number; dest_lat: number; dest_lon: number; origin_name?: string; dest_name?: string }) =>
  fetchJSON<RouteResult>('/routes/plan', { method: 'POST', body: JSON.stringify(req) });

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

// Config
export const getConfig = () => fetchJSON<any>('/config');
