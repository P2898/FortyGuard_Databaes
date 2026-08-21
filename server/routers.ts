import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { invokeLLM } from "./_core/llm";
import { listAssessments, saveAssessment } from "./assessmentDb";
import { demoHeatmap, SiteInput, scoreSite, detectAnomalies } from "./heat";

const siteSchema = z.object({ id: z.string().min(1), name: z.string().min(1), lat: z.number().min(-90).max(90), lon: z.number().min(-180).max(180) });
const analysisSchema = z.object({ sites: z.array(siteSchema).min(1).max(500), startDate: z.string().min(8), startTime: z.string().min(4), thresholdC: z.number().min(0).max(80), mode: z.enum(["demo", "live"]).default("demo"), industry: z.string().default("Industrial operations"), operationalContext: z.string().optional() });

async function callFortyGuard(input: z.infer<typeof analysisSchema>) {
  const key = process.env.FORTYGUARD_API_KEY;
  if (input.mode === "demo" || !key) return demoHeatmap(input.sites, input.thresholdC);
  const base = process.env.FORTYGUARD_BASE_URL || "https://api.fortyguard.com";
  const lats = input.sites.map(site => site.lat), lons = input.sites.map(site => site.lon), pad = 0.02;
  const polygon = { type: "FeatureCollection", features: [{ type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates: [[[Math.min(...lons) - pad, Math.min(...lats) - pad], [Math.max(...lons) + pad, Math.min(...lats) - pad], [Math.max(...lons) + pad, Math.max(...lats) + pad], [Math.min(...lons) - pad, Math.max(...lats) + pad], [Math.min(...lons) - pad, Math.min(...lats) - pad]]] } }] };
  const response = await fetch(`${base}/v1/heatmap`, { method: "POST", headers: { "api-key": key, "Content-Type": "application/json" }, body: JSON.stringify({ polygon_aoi: polygon, date_time: { start_date: input.startDate, start_time: input.startTime, filter_type: 1 }, granularity: 100 }) });
  if (!response.ok) throw new Error(`FortyGuard request failed (${response.status})`);
  const submitted = await response.json() as any;
  const activityId = submitted?.data?.activity_id || submitted?.activity_id;
  if (!activityId) throw new Error("FortyGuard did not return an activity ID");
  let result: any;
  for (let attempt = 0; attempt < 60; attempt += 1) {
    await new Promise(resolve => setTimeout(resolve, 1500));
    const statusResponse = await fetch(`${base}/v1/status/${activityId}`, { headers: { "api-key": key } });
    if (statusResponse.status === 404) continue;
    const statusPayload = await statusResponse.json() as any;
    const status = String(statusPayload?.data?.status || statusPayload?.status || "").toLowerCase();
    if (status === "failed" || status === "error") throw new Error("FortyGuard heatmap task failed");
    if (status === "completed" || status === "succeeded") { result = statusPayload?.data?.result || statusPayload?.result; break; }
  }
  if (!result) throw new Error("FortyGuard heatmap task timed out");
  const rawFeatures = result?.map_data?.features || result?.features || [];
  const tiles = rawFeatures.map((feature: any) => { const coords = feature?.geometry?.coordinates; const point = Array.isArray(coords?.[0]) ? coords[0] : coords; const value = Number(feature?.properties?.average_temperature ?? feature?.properties?.temperature ?? feature?.properties?.value ?? 0); return { lat: Number(point?.[1] || 0), lon: Number(point?.[0] || 0), value, peakTemperatureC: Number(feature?.properties?.max_temperature ?? value) }; }).filter((tile: any) => tile.lat && tile.lon);
  const values = tiles.map((tile: any) => tile.value), anomaly = detectAnomalies(values), stats = result?.stats_data || {};
  const results = input.sites.map((site, index) => { const tile = tiles[index % Math.max(tiles.length, 1)] || { value: Number(stats?.temperature_stats?.max ?? 35), peakTemperatureC: Number(stats?.temperature_stats?.max ?? 35) }; return scoreSite(site, tile.peakTemperatureC, Math.max(0, tile.value - input.thresholdC), Math.max(0, (tile.value - input.thresholdC) * 0.6), anomaly.flags[index % Math.max(anomaly.flags.length, 1)] || false); });
  return { tiles, results, stats: { min: stats.min ?? Math.min(...values), max: stats.max ?? Math.max(...values), mean: stats.mean ?? values.reduce((sum: number, value: number) => sum + value, 0) / Math.max(values.length, 1), thresholdC: input.thresholdC, anomalyUpper: anomaly.upper } };
}

async function generateBrief(results: any[], thresholdC: number) {
  const critical = results.filter(result => result.riskTier === "Critical").length, anomalies = results.filter(result => result.anomalyDetected).length, top = [...results].sort((a, b) => b.riskScore - a.riskScore).slice(0, 2).map(result => `${result.name} (${result.riskTier}, ${result.peakTemperatureC} °C)`).join(" and ");
  try {
    const response = await invokeLLM({ model: "gpt-5-mini", messages: [{ role: "system", content: "Write exactly three concise sentences. Use only the supplied facts. Do not use bullet points or headings." }, { role: "user", content: `Industrial heat assessment: ${results.length} sites, threshold ${thresholdC} °C, ${critical} Critical sites, ${anomalies} anomalous sites, highest priority ${top || "none"}. State the situation, the priority action, and the governance follow-up.` }], maxTokens: 220 });
    const text = String(response.choices[0]?.message?.content || "").replace(/\s+/g, " ").trim(), sentences = text.split(/(?<=[.!?])\s+/).filter(Boolean).slice(0, 3);
    if (sentences.length === 3) return sentences.join(" ");
  } catch { /* fallback keeps the dashboard available */ }
  return `${critical} of ${results.length} sites require immediate attention at the selected threshold. Prioritize ${top || "the highest-ranked locations"} for operational controls and supervisor review. Record the intervention and reassess the next run to track improvement.`;
}

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => { const cookieOptions = getSessionCookieOptions(ctx.req); ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 }); return { success: true } as const; }),
  }),
  heat: router({
    analyze: publicProcedure.input(analysisSchema).mutation(async ({ input, ctx }) => {
      const output = await callFortyGuard(input), summary = await generateBrief(output.results, input.thresholdC), flags = output.results.flatMap(result => result.complianceFlags.filter(flag => flag.triggered));
      if (ctx.user) await saveAssessment({ userId: ctx.user.id, mode: input.mode, startDate: input.startDate, startTime: input.startTime, thresholdC: String(input.thresholdC), industry: input.industry, operationalContext: input.operationalContext, siteCount: output.results.length, criticalCount: output.results.filter(result => result.riskTier === "Critical").length, highCount: output.results.filter(result => result.riskTier === "High").length, anomalyCount: output.results.filter(result => result.anomalyDetected).length, complianceCount: flags.length, summary, sitesJson: input.sites, resultsJson: output.results, flagsJson: flags, actionsJson: output.results.map(result => ({ siteId: result.id, action: result.recommendation, status: "pending", createdAt: new Date().toISOString() })) });
      return { ...output, summary, mode: input.mode, analyzedAt: new Date().toISOString() };
    }),
    history: publicProcedure.query(async ({ ctx }) => ctx.user ? listAssessments(ctx.user.id) : []),
  }),
});

export type AppRouter = typeof appRouter;
