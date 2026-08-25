import { useState, useEffect } from "react";
import * as api from "../lib/api";
import { getRiskColor, getRiskBg } from "./helpers";
import { useTheme } from "../lib/theme";

function TrendChart({ temps, colors }: { temps: number[]; colors: any }) {
  if (!temps.length) return <p style={{ color: colors.textSecondary }}>No trend data.</p>;
  const max = Math.max(...temps, 50);
  const scale = 160 / max;
  return (
    <svg viewBox={"0 0 " + (temps.length * 30) + " 200"} style={{ width: "100%", height: 180 }}>
      {temps.map((t, i) => {
        const x = i * 30 + 10;
        const h = t * scale;
        return (
          <g key={i}>
            <rect x={x} y={200 - h - 20} width={16} height={h} fill={t > 32.2 ? "#ef4444" : t > 26.7 ? "#f97316" : "#22c55e"} rx={2} />
            <text x={x + 8} y={195} textAnchor="middle" fontSize={8} fill={colors.textMuted}>{i}h</text>
          </g>
        );
      })}
      <text x={0} y={12} fontSize={9} fill={colors.textSecondary}>Temperature ({String.fromCharCode(176)}C)</text>
    </svg>
  );
}

export default function SiteDetail({ siteId, onBack }: { siteId: string; onBack: () => void }) {
  const { colors } = useTheme();
  const [detail, setDetail] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.getSiteDetail(siteId).then(setDetail).catch(console.error).finally(() => setLoading(false));
  }, [siteId]);

  if (loading) return <p style={{ color: colors.textSecondary }}>Loading...</p>;
  if (!detail) return <p style={{ color: colors.textSecondary }}>Site not found.</p>;

  const { site, hourly_temps, risk, env_params } = detail;

  const statRows: [string, string][] = [
    ["Temperature", risk.temperature_c + String.fromCharCode(176) + "C"],
    ["Heat Index", String(risk.heat_index)],
    ["Risk", risk.risk_bucket],
    ["Exceedance", risk.exceedance_hours + "h"],
    ["Persistence", risk.persistence_hours + "h"],
  ];

  return (
    <div>
      <button onClick={onBack} style={{ fontSize: 13, color: colors.accent, background: "none", border: "none", cursor: "pointer", marginBottom: 12 }}>
        {String.fromCharCode(8592)} Back to Dashboard
      </button>
      <h2 style={{ fontSize: 22, fontWeight: 700, color: colors.text }}>{site.name}</h2>
      <p style={{ color: colors.textSecondary, marginTop: 2 }}>{site.site_type} {String.fromCharCode(183)} {site.site_id}</p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, marginTop: 16 }}>
        {statRows.map(([l, v]) => (
          <div key={l} style={{ background: colors.surface, borderRadius: 8, padding: 16, border: `1px solid ${colors.border}` }}>
            <div style={{ fontSize: 12, color: colors.textMuted }}>{l}</div>
            <div style={{ fontSize: 22, fontWeight: 700, marginTop: 4, color: colors.text }}>{v}</div>
          </div>
        ))}
      </div>

      <div style={{ background: colors.surface, borderRadius: 12, padding: 20, border: `1px solid ${colors.border}`, marginTop: 20 }}>
        <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12, color: colors.text }}>12-Hour Trend</h3>
        <TrendChart temps={hourly_temps} colors={colors} />
      </div>

      <div style={{ background: colors.surface, borderRadius: 12, padding: 20, border: `1px solid ${colors.border}`, marginTop: 16 }}>
        <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 8, color: colors.text }}>Environmental Parameters</h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 12, fontSize: 13 }}>
          {Object.entries(env_params).map(([k, v]) => (
            <div key={k}>
              <div style={{ color: colors.textMuted }}>{k.replace(/_/g, " ")}</div>
              <div style={{ fontWeight: 600, marginTop: 2, color: colors.text }}>{String(v)}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ background: getRiskBg(risk.risk_bucket), borderRadius: 8, padding: 16, marginTop: 16, border: "1px solid " + getRiskColor(risk.risk_bucket) + "40" }}>
        <div style={{ fontWeight: 600, color: getRiskColor(risk.risk_bucket) }}>Recommendation: {risk.recommendation}</div>
        <div style={{ fontSize: 13, color: colors.textSecondary, marginTop: 4 }}>Threshold: {risk.threshold_label} ({risk.threshold_source})</div>
      </div>
    </div>
  );
}
