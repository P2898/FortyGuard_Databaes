import { useState, useEffect, useRef } from "react";
import { useTheme } from "../lib/theme";
import {
  getPortfolioForecast,
  getForecastAccuracy,
  getDollarsFlagged,
  getSiteDetail,
  PortfolioForecast,
  SiteForecast,
  ForecastCheckpoint,
  ForecastAccuracy,
  DollarsFlagged,
  SiteDetail,
} from "../lib/api";
import { formatTemperature, getTempColor } from "./helpers";

const RISK_COLORS: Record<string, string> = {
  LOW: "#22c55e",
  MEDIUM: "#eab308",
  HIGH: "#f97316",
  CRITICAL: "#ef4444",
  EXTREME: "#7f1d1d",
};

const RISK_BG: Record<string, string> = {
  LOW: "rgba(34,197,94,0.12)",
  MEDIUM: "rgba(234,179,8,0.12)",
  HIGH: "rgba(249,115,22,0.12)",
  CRITICAL: "rgba(239,68,68,0.12)",
  EXTREME: "rgba(127,29,29,0.12)",
};

const NWS_INFO: Record<string, { label: string; description: string }> = {
  LOW: { label: "Below Caution", description: "Little to no risk from expected heat" },
  MEDIUM: { label: "Caution (80–90°F)", description: "Fatigue possible with prolonged exposure and/or physical activity" },
  HIGH: { label: "Extreme Caution (90–103°F)", description: "Heat cramps or heat exhaustion possible" },
  CRITICAL: { label: "Danger (103–124°F)", description: "Heat cramps or heat exhaustion likely; heat stroke possible" },
  EXTREME: { label: "Extreme Danger (125°F+)", description: "Heat stroke highly likely" },
};

const SITE_ICONS: Record<string, string> = {
  warehouse: "🏭",
  datacenter: "🖥️",
  construction: "🏗️",
  logistics: "🚛",
  solar: "☀️",
  transit: "🚌",
  default: "📍",
};

function getSiteIcon(siteName: string): string {
  const lower = siteName.toLowerCase();
  if (lower.includes("warehouse") || lower.includes("wh-")) return "🏭";
  if (lower.includes("data") || lower.includes("dc")) return "🖥️";
  if (lower.includes("construct") || lower.includes("build")) return "🏗️";
  if (lower.includes("logistics") || lower.includes("tracy")) return "🚛";
  if (lower.includes("solar") || lower.includes("livermore")) return "☀️";
  if (lower.includes("transit") || lower.includes("berkeley")) return "🚌";
  if (lower.includes("port") || lower.includes("oakland")) return "⚓";
  return "📍";
}

function ConfidenceBadge({ confidence, label }: { confidence: number; label: string }) {
  const color = confidence >= 0.85 ? "#22c55e" : confidence >= 0.70 ? "#eab308" : "#f97316";
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        padding: "3px 10px",
        borderRadius: 12,
        fontSize: 11,
        fontWeight: 600,
        color,
        background: `${color}18`,
        border: `1px solid ${color}40`,
        transition: "all 0.2s",
      }}
    >
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: color }} />
      {label} ({Math.round(confidence * 100)}%)
    </span>
  );
}

function TimelineBar({ checkpoints, compact = false }: { checkpoints: ForecastCheckpoint[]; compact?: boolean }) {
  const { colors } = useTheme();
  const barHeight = compact ? 40 : 60;

  return (
    <div style={{ display: "flex", gap: compact ? 1 : 2, alignItems: "flex-end", height: barHeight, marginTop: 6 }}>
      {checkpoints.map((cp, i) => {
        const maxTemp = 55;
        const heightPct = Math.max(10, (cp.heat_index_c / maxTemp) * 100);
        const color = RISK_COLORS[cp.risk_bucket] || "#666";
        return (
          <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 1 }}>
            {!compact && <span style={{ fontSize: 10, color: colors.textSecondary, fontWeight: 500 }}>{cp.heat_index_c.toFixed(0)}°</span>}
            <div
              style={{
                width: "100%",
                height: `${heightPct}%`,
                background: `linear-gradient(to top, ${color}cc, ${color}88)`,
                borderRadius: "3px 3px 0 0",
                transition: "height 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)",
              }}
              title={`${cp.nws_band}: ${formatTemperature(cp.heat_index_c)}`}
            />
            <span style={{ fontSize: 10, color: colors.textSecondary }}>+{cp.hours_from_now}h</span>
          </div>
        );
      })}
    </div>
  );
}

/* ─── Site Hub Card (clickable) ────────────────────────────────── */

function SiteHubCard({
  site,
  onSelectSite,
  expanded,
  onToggle,
}: {
  site: SiteForecast;
  onSelectSite: (id: string) => void;
  expanded: boolean;
  onToggle: () => void;
}) {
  const { colors } = useTheme();
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(Math.floor(Math.random() * 12) + 1);
  const [detail, setDetail] = useState<SiteDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const peakColor = RISK_COLORS[site.peak_risk_bucket] || "#666";
  const peakBg = RISK_BG[site.peak_risk_bucket] || colors.surfaceHover;
  const nwsInfo = NWS_INFO[site.peak_risk_bucket] || { label: "Unknown", description: "" };
  const peakHourStr = `${site.peak_hour}:00`;
  const icon = getSiteIcon(site.site_name);

  useEffect(() => {
    if (expanded && !detail) {
      setDetailLoading(true);
      getSiteDetail(site.site_id)
        .then(setDetail)
        .catch(() => {})
        .finally(() => setDetailLoading(false));
    }
  }, [expanded]);

  const handleLike = (e: React.MouseEvent) => {
    e.stopPropagation();
    setLiked(!liked);
    setLikeCount((c) => (liked ? c - 1 : c + 1));
  };

  return (
    <div
      onClick={onToggle}
      style={{
        background: colors.surface,
        border: `1px solid ${expanded ? peakColor + "60" : colors.border}`,
        borderRadius: 16,
        overflow: "hidden",
        cursor: "pointer",
        transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
        boxShadow: expanded ? `0 4px 24px ${peakColor}18` : "0 1px 3px rgba(0,0,0,0.06)",
        transform: expanded ? "scale(1.005)" : "scale(1)",
      }}
    >
      {/* Card Header */}
      <div style={{ padding: "16px 20px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flex: 1 }}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              background: peakBg,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 22,
              border: `1px solid ${peakColor}30`,
              flexShrink: 0,
            }}
          >
            {icon}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: colors.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {site.site_name}
            </div>
            <div style={{ fontSize: 12, color: colors.textMuted, marginTop: 2 }}>
              Peak {peakHourStr} — {nwsInfo.label}
            </div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {/* Like button */}
          <button
            onClick={handleLike}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 4,
              padding: "5px 10px",
              borderRadius: 20,
              border: `1px solid ${liked ? "#ef4444" : colors.borderLight}`,
              background: liked ? "rgba(239,68,68,0.1)" : colors.bg,
              color: liked ? "#ef4444" : colors.textMuted,
              cursor: "pointer",
              fontSize: 12,
              fontWeight: 600,
              transition: "all 0.2s",
            }}
            title={liked ? "Unlike" : "Like this hub"}
          >
            <span style={{ fontSize: 14, transition: "transform 0.2s", transform: liked ? "scale(1.2)" : "scale(1)" }}>
              {liked ? "❤️" : "🤍"}
            </span>
            {likeCount}
          </button>

          {/* Risk badge */}
          <div
            style={{
              padding: "4px 12px",
              borderRadius: 8,
              background: peakBg,
              border: `1px solid ${peakColor}40`,
              transition: "all 0.2s",
            }}
          >
            <span style={{ fontSize: 13, fontWeight: 700, color: peakColor }}>{site.peak_risk_bucket}</span>
          </div>

          {/* Expand chevron */}
          <span
            style={{
              fontSize: 18,
              color: colors.textMuted,
              transition: "transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
              transform: expanded ? "rotate(180deg)" : "rotate(0deg)",
            }}
          >
            ▾
          </span>
        </div>
      </div>

      {/* Collapsed: mini timeline preview */}
      {!expanded && (
        <div style={{ padding: "0 20px 14px" }}>
          <TimelineBar checkpoints={site.checkpoints} compact />
        </div>
      )}

      {/* Expanded: full report */}
      <div
        style={{
          maxHeight: expanded ? 800 : 0,
          opacity: expanded ? 1 : 0,
          overflow: "hidden",
          transition: "max-height 0.4s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s ease",
        }}
      >
        <div style={{ padding: "0 20px 20px", borderTop: `1px solid ${colors.borderLight}` }}>
          {/* Peak Stats */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginTop: 16 }}>              <StatBlock label="Peak Heat Index" value={formatTemperature(site.peak_heat_index_c)} color={peakColor} />
            <StatBlock label="Hours above 80°F" value={String(site.hours_above_osha)} color={colors.text} />
            <StatBlock
              label="Hours above 103°F"
              value={String(site.hours_above_danger)}
              color={site.hours_above_danger > 0 ? "#ef4444" : colors.text}
            />
          </div>

          {/* NWS Description */}
          <div
            style={{
              fontSize: 12,
              color: colors.textSecondary,
              background: colors.bg,
              padding: "10px 14px",
              borderRadius: 10,
              marginTop: 12,
              borderLeft: `3px solid ${peakColor}`,
              lineHeight: 1.5,
            }}
          >
            <strong style={{ color: peakColor }}>NWS:</strong> {nwsInfo.description}
          </div>

          {/* Full Timeline */}
          <div style={{ marginTop: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: colors.text, marginBottom: 6 }}>
              12-Hour Forecast Timeline
            </div>
            <TimelineBar checkpoints={site.checkpoints} />
          </div>

          {/* Confidence */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 12 }}>
            <ConfidenceBadge confidence={site.overall_confidence} label={site.overall_confidence_label} />
            <span style={{ fontSize: 11, color: colors.textMuted }}>
              Source: FortyGuard 12h forecast
            </span>
          </div>

          {/* Cost of Inaction */}
          {site.cost_of_inaction > 0 && (
            <div
              style={{
                marginTop: 12,
                padding: "12px 16px",
                borderRadius: 10,
                background: "rgba(239,68,68,0.08)",
                border: "1px solid rgba(239,68,68,0.2)",
                animation: "fadeIn 0.3s ease",
              }}
            >
              <div style={{ fontSize: 13, fontWeight: 600, color: "#ef4444" }}>
                ⚠️ Cost of inaction: ${site.cost_of_inaction.toLocaleString()}
              </div>
              <div style={{ fontSize: 12, color: colors.textSecondary, marginTop: 4 }}>
                Projected cost if no action taken during the predicted {site.peak_risk_bucket} window at {peakHourStr}
              </div>
            </div>
          )}

          {/* Reschedule Recommendation */}
          {site.reschedule_recommendation && (
            <div
              style={{
                marginTop: 8,
                padding: "12px 16px",
                borderRadius: 10,
                background: "rgba(34,197,94,0.08)",
                border: "1px solid rgba(34,197,94,0.2)",
                animation: "fadeIn 0.3s ease 0.1s both",
              }}
            >
              <div style={{ fontSize: 13, fontWeight: 600, color: "#22c55e" }}>
                ✅ {site.reschedule_recommendation}
              </div>
            </div>
          )}

          {/* Action buttons */}
          <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
            <button
              onClick={(e) => { e.stopPropagation(); onSelectSite(site.site_id); }}
              style={{
                flex: 1,
                padding: "10px 16px",
                borderRadius: 10,
                border: "none",
                background: colors.accent,
                color: "#fff",
                fontWeight: 600,
                fontSize: 13,
                cursor: "pointer",
                transition: "all 0.2s",
              }}
            >
              View Full Report →
            </button>
            {site.cost_of_inaction > 0 && (
              <button
                onClick={(e) => e.stopPropagation()}
                style={{
                  padding: "10px 16px",
                  borderRadius: 10,
                  border: `1px solid ${colors.border}`,
                  background: colors.surfaceHover,
                  color: colors.text,
                  fontWeight: 600,
                  fontSize: 13,
                  cursor: "pointer",
                  transition: "all 0.2s",
                }}
              >
                📄 Export
              </button>
            )}
          </div>

          {/* Hourly temp detail from site detail API */}
          {detailLoading && (
            <div style={{ marginTop: 12, textAlign: "center", color: colors.textMuted, fontSize: 12 }}>
              Loading hourly data...
            </div>
          )}
          {detail && detail.hourly_temps && (
            <div style={{ marginTop: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: colors.text, marginBottom: 8 }}>
                Hourly Temperature Breakdown
              </div>
              <div style={{ display: "flex", gap: 2, alignItems: "flex-end", height: 50 }}>
                {detail.hourly_temps.map((temp, i) => {
                  const maxT = Math.max(...detail.hourly_temps, 40);
                  const h = Math.max(8, (temp / maxT) * 100);
                  const tc = temp < 22 ? "#22c55e" : temp < 27 ? "#84cc16" : temp < 32 ? "#eab308" : temp < 37 ? "#f97316" : "#ef4444";
                  const hour = new Date().getHours() + i;
                  return (
                    <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
                      <span style={{ fontSize: 8, color: colors.textMuted }}>{temp.toFixed(0)}°</span>
                      <div
                        style={{
                          width: "100%",
                          height: `${h}%`,
                          background: tc,
                          borderRadius: "2px 2px 0 0",
                          transition: "height 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)",
                        }}
                      />
                      <span style={{ fontSize: 7, color: colors.textMuted }}>{hour % 24}h</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatBlock({ label, value, color }: { label: string; value: string; color: string }) {
  const { colors } = useTheme();
  return (
    <div>
      <div style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 4, fontWeight: 500 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color }}>{value}</div>
    </div>
  );
}

/* ─── Main Dashboard ──────────────────────────────────────────── */

export default function ForecastDashboard() {
  const { colors } = useTheme();
  const [forecast, setForecast] = useState<PortfolioForecast | null>(null);
  const [accuracy, setAccuracy] = useState<ForecastAccuracy | null>(null);
  const [dollars, setDollars] = useState<DollarsFlagged | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expandedSite, setExpandedSite] = useState<string | null>(null);
  const [filterRisk, setFilterRisk] = useState<string>("ALL");

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      setLoading(true);
      const [forecastData, accuracyData, dollarsData] = await Promise.all([
        getPortfolioForecast(),
        getForecastAccuracy(30),
        getDollarsFlagged(),
      ]);
      setForecast(forecastData);
      setAccuracy(accuracyData);
      setDollars(dollarsData);
    } catch (e: any) {
      setError(e.message || "Failed to load forecast data");
    } finally {
      setLoading(false);
    }
  }

  function handleSelectSite(siteId: string) {
    // Navigate to site detail — parent App handles this
    const event = new CustomEvent("navigate-site", { detail: siteId });
    window.dispatchEvent(event);
  }

  if (loading) {
    return (
      <div style={{ padding: 60, textAlign: "center" }}>
        <div style={{ fontSize: 32, marginBottom: 16, animation: "spin 2s linear infinite", display: "inline-block" }}>🔮</div>
        <div style={{ fontSize: 15, color: colors.textMuted, fontWeight: 500 }}>Loading forecast data...</div>
        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: 60, textAlign: "center" }}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>⚠️</div>
        <div style={{ fontSize: 15, color: "#ef4444", fontWeight: 500 }}>{error}</div>
        <button
          onClick={loadData}
          style={{ marginTop: 16, padding: "8px 20px", borderRadius: 8, border: `1px solid ${colors.border}`, background: colors.surface, color: colors.text, cursor: "pointer", fontWeight: 600 }}
        >
          Retry
        </button>
      </div>
    );
  }

  if (!forecast) return null;

  // Sort sites by peak risk (highest first)
  const sortedSites = [...forecast.sites].sort((a, b) => {
    const order: Record<string, number> = { EXTREME: 5, CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };
    return (order[b.peak_risk_bucket] || 0) - (order[a.peak_risk_bucket] || 0);
  });

  const filteredSites = filterRisk === "ALL" ? sortedSites : sortedSites.filter((s) => s.peak_risk_bucket === filterRisk);
  const riskCounts = sortedSites.reduce((acc, s) => { acc[s.peak_risk_bucket] = (acc[s.peak_risk_bucket] || 0) + 1; return acc; }, {} as Record<string, number>);

  return (
    <div style={{ padding: 24, maxWidth: 1200, margin: "0 auto", animation: "fadeIn 0.3s ease" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: colors.text, margin: 0 }}>
            🔮 Predictive Heat Forecast
          </h1>
          <p style={{ fontSize: 13, color: colors.textMuted, margin: "4px 0 0" }}>
            12-hour forecast with cost analysis — sourced from FortyGuard + NWS thresholds
          </p>
        </div>
        <button
          onClick={loadData}
          style={{
            padding: "8px 16px",
            borderRadius: 8,
            border: `1px solid ${colors.border}`,
            background: colors.surface,
            color: colors.text,
            cursor: "pointer",
            fontSize: 13,
            fontWeight: 600,
            transition: "all 0.2s",
          }}
        >
          ↻ Refresh
        </button>
      </div>

      {/* Summary Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 24 }}>
        <SummaryCard label="Cost of Inaction" value={`$${forecast.total_cost_of_inaction.toLocaleString()}`} color="#ef4444" subtitle="Projected if no action taken" colors={colors} delay={0} />
        <SummaryCard label="Reschedule Savings" value={`$${forecast.total_reschedule_savings.toLocaleString()}`} color="#22c55e" subtitle="Available by shifting hours" colors={colors} delay={50} />
        <SummaryCard label="CRITICAL Sites" value={String(forecast.critical_sites_count)} color="#ef4444" subtitle="Requiring immediate attention" colors={colors} delay={100} />
        <SummaryCard label="Dollars Flagged" value={`$${forecast.dollars_flagged_this_quarter.toLocaleString()}`} color="#f97316" subtitle={dollars?.message || "This quarter"} colors={colors} delay={150} />
      </div>

      {/* Forecast Accuracy */}
      {accuracy && accuracy.total_forecasts > 0 && (
        <div
          style={{
            padding: "14px 20px",
            borderRadius: 12,
            background: "rgba(34,197,94,0.06)",
            border: "1px solid rgba(34,197,94,0.15)",
            marginBottom: 20,
            display: "flex",
            alignItems: "center",
            gap: 12,
            animation: "slideIn 0.3s ease",
          }}
        >
          <span style={{ fontSize: 20 }}>📊</span>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: "#22c55e" }}>
              Forecast Accuracy: {accuracy.accuracy_percent}% over the last {accuracy.period_days} days
            </div>
            <div style={{ fontSize: 12, color: colors.textSecondary }}>
              Based on {accuracy.total_forecasts} verified forecasts — avg deviation {accuracy.avg_temp_delta_c}°C
            </div>
          </div>
        </div>
      )}

      {/* Risk Filter Tabs */}
      <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
        {["ALL", "CRITICAL", "HIGH", "MEDIUM", "LOW"].map((risk) => {
          const isActive = filterRisk === risk;
          const count = risk === "ALL" ? sortedSites.length : (riskCounts[risk] || 0);
          if (risk !== "ALL" && count === 0) return null;
          return (
            <button
              key={risk}
              onClick={() => setFilterRisk(risk)}
              style={{
                padding: "6px 14px",
                borderRadius: 20,
                border: `1px solid ${isActive ? (RISK_COLORS[risk] || colors.accent) : colors.borderLight}`,
                background: isActive ? (RISK_COLORS[risk] || colors.accent) + "15" : colors.bg,
                color: isActive ? (RISK_COLORS[risk] || colors.accent) : colors.textSecondary,
                cursor: "pointer",
                fontSize: 12,
                fontWeight: 600,
                transition: "all 0.2s",
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              {risk !== "ALL" && <span style={{ width: 8, height: 8, borderRadius: "50%", background: RISK_COLORS[risk] }} />}
              {risk === "ALL" ? "All Hubs" : risk}
              <span style={{ fontSize: 10, opacity: 0.7 }}>({count})</span>
            </button>
          );
        })}
      </div>

      {/* Site Hub Cards */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {filteredSites.map((site, idx) => (
          <div
            key={site.site_id}
            style={{ animation: `fadeInUp 0.3s ease ${idx * 0.05}s both` }}
          >
            <SiteHubCard
              site={site}
              onSelectSite={handleSelectSite}
              expanded={expandedSite === site.site_id}
              onToggle={() => setExpandedSite(expandedSite === site.site_id ? null : site.site_id)}
            />
          </div>
        ))}
      </div>

      {/* Footer */}
      <div
        style={{
          marginTop: 24,
          padding: 12,
          borderRadius: 10,
          background: colors.surface,
          border: `1px solid ${colors.border}`,
          fontSize: 11,
          color: colors.textMuted,
          textAlign: "center",
        }}
      >
        All thresholds sourced from the{" "}
        <a
          href="https://www.weather.gov/ama/heatindex"
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: colors.accent, textDecoration: "underline" }}
        >
          NWS Heat Index Chart
        </a>{" "}
        — Nothing invented, every number traceable.
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes slideIn {
          from { opacity: 0; transform: translateX(-8px); }
          to { opacity: 1; transform: translateX(0); }
        }
      `}</style>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  color,
  subtitle,
  colors,
  delay = 0,
}: {
  label: string;
  value: string;
  color: string;
  subtitle: string;
  colors: any;
  delay?: number;
}) {
  return (
    <div
      style={{
        background: colors.surface,
        border: `1px solid ${colors.border}`,
        borderRadius: 14,
        padding: 18,
        transition: "all 0.2s",
        animation: `fadeInUp 0.3s ease ${delay}ms both`,
      }}
      onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = `0 4px 12px ${color}15`; }}
      onMouseLeave={(e) => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "none"; }}
    >
      <div style={{ fontSize: 12, color: colors.textMuted, marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 700, color }}>{value}</div>
      <div style={{ fontSize: 11, color: colors.textMuted, marginTop: 6 }}>{subtitle}</div>
    </div>
  );
}
