import { useState, useEffect } from "react";
import { Site, Assessment, getHeatPL } from "../lib/api";
import { getRiskColor, getRiskBg, exportCSV } from "./helpers";
import { useTheme } from "../lib/theme";

const RISK_ORDER: Record<string, number> = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };

function Tooltip({ text, children }: { text: string; children: React.ReactNode }) {
  const [show, setShow] = useState(false);
  return (
    <span
      style={{ position: "relative", display: "inline-block", cursor: "help" }}
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      {children}
      {show && (
        <span style={{ position: "absolute", bottom: "110%", left: "50%", transform: "translateX(-50%)", background: "#1f2937", color: "#fff", padding: "4px 8px", borderRadius: 4, fontSize: 11, whiteSpace: "nowrap", zIndex: 99 }}>
          {text}
        </span>
      )}
    </span>
  );
}

function RiskDistChart({ assessments }: { assessments: Assessment[] }) {
  const { colors } = useTheme();
  const counts = { LOW: 0, MEDIUM: 0, HIGH: 0, CRITICAL: 0 };
  assessments.forEach((a) => {
    if (a.risk_bucket in counts) counts[a.risk_bucket as keyof typeof counts]++;
  });
  const total = assessments.length || 1;
  const barData: [string, number, string][] = [
    ["LOW", counts.LOW, "#22c55e"],
    ["MEDIUM", counts.MEDIUM, "#eab308"],
    ["HIGH", counts.HIGH, "#f97316"],
    ["CRITICAL", counts.CRITICAL, "#ef4444"],
  ];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4, width: "100%" }}>
      {barData.map(([label, count, color]) => (
        <div key={label} style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 11, width: 60, color: colors.textSecondary }}>{label}</span>
          <div style={{ flex: 1, height: 16, background: colors.surfaceHover, borderRadius: 4, overflow: "hidden" }}>
            <div style={{ width: `${(count / total) * 100}%`, height: "100%", background: color, borderRadius: 4, transition: "width 0.3s" }} />
          </div>
          <span style={{ fontSize: 11, color: colors.textMuted, width: 24, textAlign: "right" }}>{count}</span>
        </div>
      ))}
    </div>
  );
}

interface FleetDashboardProps {
  sites: Site[];
  assessments: Assessment[];
  onSelectSite: (id: string) => void;
  onNavigate?: (view: string, options?: any) => void;
}

export default function FleetDashboard({ sites, assessments, onSelectSite, onNavigate }: FleetDashboardProps) {
  const { colors } = useTheme();
  const [sortBy, setSortBy] = useState<"risk" | "temp">("risk");
  const [searchQuery, setSearchQuery] = useState("");
  const [riskFilter, setRiskFilter] = useState<string>("ALL");
  const [selectedSites, setSelectedSites] = useState<Set<string>>(new Set());
  const [showComparison, setShowComparison] = useState(false);

  const siteData = sites
    .map((s) => {
      const latest = [...assessments].reverse().find((a) => a.site_id === s.site_id);
      return { ...s, assessment: latest };
    })
    .filter((s) => {
      const matchesSearch =
        !searchQuery ||
        s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.site_type.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.site_id.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesRisk =
        riskFilter === "ALL" || s.assessment?.risk_bucket === riskFilter;
      return matchesSearch && matchesRisk;
    })
    .sort((a, b) =>
      sortBy === "risk"
        ? (RISK_ORDER[b.assessment?.risk_bucket || "LOW"] || 0) - (RISK_ORDER[a.assessment?.risk_bucket || "LOW"] || 0)
        : (b.assessment?.temperature_c || 0) - (a.assessment?.temperature_c || 0)
    );

  const toggleSiteSelection = (siteId: string) => {
    setSelectedSites((prev) => {
      const next = new Set(prev);
      if (next.has(siteId)) next.delete(siteId);
      else if (next.size < 3) next.add(siteId);
      return next;
    });
  };

  const selectedSiteData = siteData.filter((s) => selectedSites.has(s.site_id));

  // Quick stats
  const alertCount = assessments.filter((a) => a.risk_bucket === "CRITICAL" || a.risk_bucket === "HIGH").length;
  const avgTemp = assessments.length
    ? assessments.reduce((sum, a) => sum + a.temperature_c, 0) / assessments.length
    : 0;
  const [dailyCost, setDailyCost] = useState<number | null>(null);
  useEffect(() => {
    getHeatPL()
      .then((pl) => setDailyCost(pl.total_cost))
      .catch(() => {});
  }, [assessments]);

  const statCards: { label: string; value: string; color: string; onClick?: () => void; hint: string }[] = [
    {
      label: "Total Sites",
      value: String(sites.length),
      color: colors.accent,
      hint: "View all sites",
      onClick: () => onNavigate?.("dashboard"),
    },
    {
      label: "Active Alerts",
      value: String(alertCount),
      color: alertCount > 0 ? "#ef4444" : "#22c55e",
      hint: alertCount > 0 ? "Filter to HIGH/CRITICAL" : "No alerts",
      onClick: alertCount > 0 ? () => onNavigate?.("dashboard", { riskFilter: "CRITICAL" }) : undefined,
    },
    {
      label: "Avg Temp",
      value: avgTemp.toFixed(1) + "°C",
      color: avgTemp > 32 ? "#f97316" : "#22c55e",
      hint: "Sort by temperature",
      onClick: () => onNavigate?.("dashboard", { sortBy: "temp" }),
    },
    {
      label: "Daily Heat Cost",
      value: dailyCost !== null ? "$" + dailyCost.toLocaleString() : "—",
      color: "#f59e0b",
      hint: "View Heat P&L",
      onClick: () => onNavigate?.("heatpl"),
    },
  ];

  return (
    <div>
      {/* Quick Stats Row */}
      <div className="stats-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12, marginBottom: 20 }}>
        {statCards.map((card) => (
          <div
            key={card.label}
            onClick={card.onClick}
            style={{
              background: colors.surface,
              borderRadius: 10,
              padding: "14px 18px",
              border: `1px solid ${colors.border}`,
              cursor: card.onClick ? "pointer" : "default",
              transition: "all 0.15s",
              position: "relative",
            }}
            onMouseEnter={(e) => {
              if (card.onClick) {
                e.currentTarget.style.borderColor = colors.accent;
                e.currentTarget.style.transform = "translateY(-1px)";
                e.currentTarget.style.boxShadow = `0 4px 12px ${colors.accent}15`;
              }
            }}
            onMouseLeave={(e) => {
              if (card.onClick) {
                e.currentTarget.style.borderColor = colors.border;
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.boxShadow = "none";
              }
            }}
          >
            <div style={{ fontSize: 12, color: colors.textMuted, marginBottom: 4 }}>{card.label}</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: card.color, fontVariantNumeric: "tabular-nums" }}>
              {card.value}
            </div>
            {card.onClick && (
              <div style={{ fontSize: 10, color: colors.accent, marginTop: 6, opacity: 0.8 }}>
                {card.hint} →
              </div>
            )}
          </div>
        ))}
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 8 }}>
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 700, color: colors.text }}>Fleet Dashboard</h2>
          <p style={{ color: colors.textSecondary, marginTop: 2 }}>Ranked by {sortBy === "risk" ? "risk level" : "temperature"}</p>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          {selectedSites.size >= 2 && (
            <button
              onClick={() => setShowComparison(!showComparison)}
              style={{
                fontSize: 12,
                padding: "6px 14px",
                background: showComparison ? "#0891b2" : colors.accent,
                color: "#fff",
                border: "none",
                borderRadius: 6,
                cursor: "pointer",
                fontWeight: 600,
              }}
            >
              {showComparison ? "Close Compare" : `Compare (${selectedSites.size})`}
            </button>
          )}
          <button
            onClick={() => exportCSV(siteData.map((s) => ({ site_id: s.site_id, name: s.name, risk: s.assessment?.risk_bucket || "N/A", temp_c: s.assessment?.temperature_c || 0, heat_index: s.assessment?.heat_index || 0, exceedance: s.assessment?.exceedance_hours || 0 })), "fleet_dashboard.csv")}
            style={{ fontSize: 12, color: colors.textSecondary, background: colors.surfaceHover, border: `1px solid ${colors.borderLight}`, borderRadius: 4, padding: "4px 10px", cursor: "pointer" }}
          >
            CSV {"\u2193"}
          </button>
          <button onClick={() => setSortBy(sortBy === "risk" ? "temp" : "risk")} style={{ fontSize: 13, padding: "4px 12px", background: colors.surfaceHover, border: `1px solid ${colors.borderLight}`, borderRadius: 6, cursor: "pointer", color: colors.text }}>
            Sort: {sortBy === "risk" ? "Temp" : "Risk"}
          </button>
        </div>
      </div>

      {/* Search & Filter Row */}
      <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
        <input
          type="text"
          placeholder="Search sites..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{
            flex: 1,
            minWidth: 200,
            padding: "8px 14px",
            background: colors.surface,
            border: `1px solid ${colors.borderLight}`,
            borderRadius: 8,
            color: colors.text,
            fontSize: 13,
            outline: "none",
          }}
        />
        <select
          value={riskFilter}
          onChange={(e) => setRiskFilter(e.target.value)}
          style={{
            padding: "8px 14px",
            background: colors.surface,
            border: `1px solid ${colors.borderLight}`,
            borderRadius: 8,
            color: colors.text,
            fontSize: 13,
            cursor: "pointer",
            outline: "none",
          }}
        >
          <option value="ALL">All Risk Levels</option>
          <option value="CRITICAL">🔴 CRITICAL</option>
          <option value="HIGH">🟠 HIGH</option>
          <option value="MEDIUM">🟡 MEDIUM</option>
          <option value="LOW">🟢 LOW</option>
        </select>
      </div>

      {/* Comparison hint */}
      {selectedSites.size === 0 && (
        <div style={{ fontSize: 11, color: colors.textMuted, marginBottom: 8, marginTop: -8 }}>
          ☐ Check 2-3 sites to compare them side-by-side
        </div>
      )}

      {/* Table — horizontal scroll on mobile */}
      <div style={{ background: colors.surface, borderRadius: 12, border: `1px solid ${colors.border}`, overflow: "hidden" }}>
        <div style={{ overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
          <table className="site-table" style={{ width: "100%", borderCollapse: "collapse", fontSize: 14, minWidth: 640 }}>
            <thead>
              <tr style={{ background: colors.bg, borderBottom: `1px solid ${colors.border}` }}>
                {["", "Site", "Type", "Risk", "Temp C", "Heat Idx", "Exceed", "Persist", ""].map((h) => (
                  <th key={h || "sel"} style={{ textAlign: ["", "Site", "Type", "Risk"].includes(h) ? "left" : "right", padding: "10px 14px", fontWeight: 600, fontSize: 12, textTransform: "uppercase", color: colors.textMuted, whiteSpace: "nowrap" }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {siteData.map((s) => (
                <tr key={s.site_id} className={selectedSites.has(s.site_id) ? "selected-row" : ""} style={{ borderBottom: `1px solid ${colors.border}`, cursor: "pointer" }} onClick={() => onSelectSite(s.site_id)}>
                  <td style={{ padding: "10px 8px 10px 14px" }} onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={selectedSites.has(s.site_id)}
                      onChange={() => toggleSiteSelection(s.site_id)}
                      disabled={!selectedSites.has(s.site_id) && selectedSites.size >= 3}
                      style={{ cursor: "pointer", accentColor: colors.accent }}
                    />
                  </td>
                  <td style={{ padding: "10px 14px", fontWeight: 500, color: colors.text, whiteSpace: "nowrap" }}>{s.name}</td>
                  <td style={{ padding: "10px 14px", color: colors.textSecondary, whiteSpace: "nowrap" }}>{s.site_type}</td>
                  <td style={{ padding: "10px 14px" }}>
                    <Tooltip text={s.assessment?.threshold_source || "NIOSH/OSHA thresholds"}>
                      <span style={{ padding: "2px 10px", borderRadius: 12, fontSize: 12, fontWeight: 600, color: "#fff", background: getRiskColor(s.assessment?.risk_bucket || "LOW") }}>
                        {s.assessment?.risk_bucket || "N/A"}
                      </span>
                    </Tooltip>
                  </td>
                  <td style={{ padding: "10px 14px", textAlign: "right", fontVariantNumeric: "tabular-nums", color: colors.text }}>{s.assessment?.temperature_c?.toFixed(1) || "\u2014"}</td>
                  <td style={{ padding: "10px 14px", textAlign: "right", fontVariantNumeric: "tabular-nums", color: colors.text }}>{s.assessment?.heat_index?.toFixed(1) || "\u2014"}</td>
                  <td style={{ padding: "10px 14px", textAlign: "right", color: colors.text }}>{s.assessment?.exceedance_hours?.toFixed(1) || "\u2014"}h</td>
                  <td style={{ padding: "10px 14px", textAlign: "right", color: colors.text }}>{s.assessment?.persistence_hours?.toFixed(1) || "\u2014"}h</td>
                  <td style={{ padding: "10px 14px" }}><button style={{ fontSize: 12, color: colors.accent, background: "none", border: "none", cursor: "pointer" }}>View {"\u2192"}</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!siteData.length && <p style={{ padding: 24, textAlign: "center", color: colors.textDim }}>No sites. Go to Setup.</p>}
      </div>

      {/* Comparison Panel */}
      {showComparison && selectedSiteData.length >= 2 && (
        <div style={{ marginTop: 20, background: colors.surface, borderRadius: 12, padding: 20, border: `1px solid ${colors.accent}40` }}>
          <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16, color: colors.accent }}>Site Comparison</h3>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 400 }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${colors.border}` }}>
                  <th style={{ textAlign: "left", padding: "8px 12px", color: colors.textMuted, fontSize: 11, textTransform: "uppercase" }}>Metric</th>
                  {selectedSiteData.map((s) => (
                    <th key={s.site_id} style={{ textAlign: "center", padding: "8px 12px", color: colors.text, fontWeight: 600 }}>{s.name}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[
                  { label: "Risk", get: (s: any) => s.assessment?.risk_bucket || "N/A" },
                  { label: "Temperature", get: (s: any) => s.assessment?.temperature_c?.toFixed(1) + "°C" || "—" },
                  { label: "Heat Index", get: (s: any) => s.assessment?.heat_index?.toFixed(1) || "—" },
                  { label: "Exceedance", get: (s: any) => (s.assessment?.exceedance_hours?.toFixed(1) || "—") + "h" },
                  { label: "Persistence", get: (s: any) => (s.assessment?.persistence_hours?.toFixed(1) || "—") + "h" },
                  { label: "Site Type", get: (s: any) => s.site_type },
                ].map((row) => (
                  <tr key={row.label} style={{ borderBottom: `1px solid ${colors.border}` }}>
                    <td style={{ padding: "8px 12px", color: colors.textSecondary }}>{row.label}</td>
                    {selectedSiteData.map((s) => (
                      <td key={s.site_id} style={{ padding: "8px 12px", textAlign: "center", fontVariantNumeric: "tabular-nums", color: colors.text }}>
                        {row.label === "Risk" ? (
                          <span style={{ padding: "2px 8px", borderRadius: 10, fontSize: 11, fontWeight: 600, color: "#fff", background: getRiskColor(s.assessment?.risk_bucket || "LOW") }}>
                            {row.get(s)}
                          </span>
                        ) : row.get(s)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div style={{ marginTop: 20, background: colors.surface, borderRadius: 12, padding: 20, border: `1px solid ${colors.border}` }}>
        <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: colors.text }}>Risk Distribution</h3>
        <RiskDistChart assessments={assessments} />
      </div>
    </div>
  );
}
