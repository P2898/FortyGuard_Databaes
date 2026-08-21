export type SiteInput = {
  id: string;
  name: string;
  lat: number;
  lon: number;
};

export type HeatTile = {
  lat: number;
  lon: number;
  value: number;
  peakTemperatureC: number;
};

export type ComplianceFlag = {
  code: "OSHA_35C" | "UAE_45C";
  label: string;
  thresholdC: number;
  triggered: boolean;
  message: string;
};

export type SiteRisk = SiteInput & {
  peakTemperatureC: number;
  exceedanceHours: number;
  persistenceHours: number;
  anomalyDetected: boolean;
  riskScore: number;
  riskTier: "Critical" | "High" | "Moderate" | "Low";
  recommendation: string;
  complianceFlags: ComplianceFlag[];
};

export function percentile(sorted: number[], p: number) {
  if (!sorted.length) return 0;
  const index = (sorted.length - 1) * p;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return sorted[lower] ?? 0;
  return (sorted[lower] ?? 0) + ((sorted[upper] ?? 0) - (sorted[lower] ?? 0)) * (index - lower);
}

export function detectAnomalies(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  const q1 = percentile(sorted, 0.25);
  const q3 = percentile(sorted, 0.75);
  const iqr = q3 - q1;
  const upper = q3 + 1.5 * iqr;
  return { q1, q3, iqr, upper, flags: values.map(value => value > upper) };
}

export function classifyRisk(score: number): SiteRisk["riskTier"] {
  if (score >= 80) return "Critical";
  if (score >= 60) return "High";
  if (score >= 35) return "Moderate";
  return "Low";
}

export function recommendationFor(site: Pick<SiteRisk, "riskTier" | "peakTemperatureC" | "exceedanceHours" | "persistenceHours">) {
  if (site.riskTier === "Critical") return "Halt outdoor work 12:00–15:00 and deploy a mobile cooling unit.";
  if (site.riskTier === "High") return "Deploy a mobile cooling unit and schedule a supervisor heat check.";
  if (site.riskTier === "Moderate") return "Add shade, hydration, and a scheduled rest rotation during peak heat.";
  return "Continue monitoring and keep hydration and shaded-rest guidance visible.";
}

export function complianceFlags(peakTemperatureC: number): ComplianceFlag[] {
  return [
    {
      code: "OSHA_35C",
      label: "OSHA example",
      thresholdC: 35,
      triggered: peakTemperatureC >= 35,
      message: peakTemperatureC >= 35 ? "OSHA 35 °C example threshold exceeded." : "Below OSHA 35 °C example threshold.",
    },
    {
      code: "UAE_45C",
      label: "UAE example",
      thresholdC: 45,
      triggered: peakTemperatureC >= 45,
      message: peakTemperatureC >= 45 ? "UAE 45 °C example threshold exceeded." : "Below UAE 45 °C example threshold.",
    },
  ];
}

export function scoreSite(site: SiteInput, peakTemperatureC: number, exceedanceHours: number, persistenceHours: number, anomalyDetected = false): SiteRisk {
  const temperatureComponent = Math.min(40, Math.max(0, (peakTemperatureC - 25) * 2));
  const exceedanceComponent = Math.min(35, exceedanceHours * 3.5);
  const persistenceComponent = Math.min(25, persistenceHours * 2.5);
  const riskScore = Math.round(Math.min(100, temperatureComponent + exceedanceComponent + persistenceComponent + (anomalyDetected ? 8 : 0)));
  const riskTier = classifyRisk(riskScore);
  const partial = { riskTier, peakTemperatureC, exceedanceHours, persistenceHours };
  return {
    ...site,
    peakTemperatureC: Number(peakTemperatureC.toFixed(1)),
    exceedanceHours: Number(exceedanceHours.toFixed(1)),
    persistenceHours: Number(persistenceHours.toFixed(1)),
    anomalyDetected,
    riskScore,
    riskTier,
    recommendation: recommendationFor(partial),
    complianceFlags: complianceFlags(peakTemperatureC),
  };
}

export function demoHeatmap(sites: SiteInput[], thresholdC: number) {
  const centerLat = sites.reduce((sum, site) => sum + site.lat, 0) / Math.max(sites.length, 1);
  const centerLon = sites.reduce((sum, site) => sum + site.lon, 0) / Math.max(sites.length, 1);
  const tiles: HeatTile[] = Array.from({ length: 32 }, (_, index) => {
    const angle = (index / 32) * Math.PI * 2;
    const radial = 0.004 + (index % 4) * 0.001;
    const value = 29 + (index % 7) * 1.35 + (index === 27 ? 10 : 0);
    return { lat: centerLat + Math.sin(angle) * radial, lon: centerLon + Math.cos(angle) * radial, value: Number(value.toFixed(1)), peakTemperatureC: Number(value.toFixed(1)) };
  });
  const anomaly = detectAnomalies(tiles.map(tile => tile.value));
  const results = sites.map((site, index) => {
    const tile = tiles[index % tiles.length] ?? tiles[0];
    const peak = Math.max(thresholdC - 2 + (index % 4) * 2.1, tile.value);
    const exceedance = Math.max(0, Number(((peak - thresholdC) * 1.8 + 2 + (index % 3) * 1.5).toFixed(1)));
    const persistence = Math.max(0, Number((exceedance * 0.58 + (index % 2) * 1.5).toFixed(1)));
    return scoreSite(site, peak, exceedance, persistence, anomaly.flags[index % anomaly.flags.length] ?? false);
  });
  return { tiles, results, stats: { min: Math.min(...tiles.map(tile => tile.value)), max: Math.max(...tiles.map(tile => tile.value)), mean: tiles.reduce((sum, tile) => sum + tile.value, 0) / tiles.length, thresholdC, anomalyUpper: anomaly.upper } };
}
