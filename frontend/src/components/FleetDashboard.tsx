import { useState } from "react";
import { Site, Assessment } from "../lib/api";
import { getRiskColor, getRiskBg, exportCSV } from "./helpers";

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
          <span style={{ fontSize: 11, width: 60, color: "#94a3b8" }}>{label}</span>
          <div style={{ flex: 1, height: 16, background: "#1e293b", borderRadius: 4, overflow: "hidden" }}>
            <div style={{ width: `${(count / total) * 100}%`, height: "100%", background: color, borderRadius: 4, transition: "width 0.3s" }} />
          </div>
          <span style={{ fontSize: 11, color: "#64748b", width: 24, textAlign: "right" }}>{count}</span>
        </div>
      ))}
    </div>
  );
}

export default function FleetDashboard({ sites, assessments, onSelectSite }: { sites: Site[]; assessments: Assessment[]; onSelectSite: (id: string) => void }) {
  const [sortBy, setSortBy] = useState<"risk" | "temp">("risk");

  const siteData = sites
    .map((s) => {
      const latest = [...assessments].reverse().find((a) => a.site_id === s.site_id);
      return { ...s, assessment: latest };
    })
    .sort((a, b) =>
      sortBy === "risk"
        ? (RISK_ORDER[b.assessment?.risk_bucket || "LOW"] || 0) - (RISK_ORDER[a.assessment?.risk_bucket || "LOW"] || 0)
        : (b.assessment?.temperature_c || 0) - (a.assessment?.temperature_c || 0)
    );

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 8 }}>
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 700 }}>Fleet Dashboard</h2>
          <p style={{ color: "#94a3b8", marginTop: 2 }}>Ranked by {sortBy === "risk" ? "risk level" : "temperature"}</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={() => exportCSV(siteData.map((s) => ({ site_id: s.site_id, name: s.name, risk: s.assessment?.risk_bucket || "N/A", temp_c: s.assessment?.temperature_c || 0, heat_index: s.assessment?.heat_index || 0, exceedance: s.assessment?.exceedance_hours || 0 })), "fleet_dashboard.csv")}
            style={{ fontSize: 12, color: "#94a3b8", background: "#1e293b", border: "1px solid #334155", borderRadius: 4, padding: "4px 10px", cursor: "pointer" }}
          >
            CSV {"\u2193"}
          </button>
          <button onClick={() => setSortBy(sortBy === "risk" ? "temp" : "risk")} style={{ fontSize: 13, padding: "4px 12px", background: "#1e293b", border: "1px solid #334155", borderRadius: 6, cursor: "pointer", color: "#e2e8f0" }}>
            Sort: {sortBy === "risk" ? "Temp" : "Risk"}
          </button>
        </div>
      </div>

      <div style={{ background: "#111827", borderRadius: 12, border: "1px solid #1e293b", overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
          <thead>
            <tr style={{ background: "#0f172a", borderBottom: "1px solid #1e293b" }}>
              {["Site", "Type", "Risk", "Temp C", "Heat Idx", "Exceed", "Persist", ""].map((h) => (
                <th key={h} style={{ textAlign: ["Site", "Type", "Risk"].includes(h) ? "left" : "right", padding: "10px 14px", fontWeight: 600, fontSize: 12, textTransform: "uppercase", color: "#64748b" }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {siteData.map((s) => (
              <tr key={s.site_id} style={{ borderBottom: "1px solid #1e293b", cursor: "pointer" }} onClick={() => onSelectSite(s.site_id)}>
                <td style={{ padding: "10px 14px", fontWeight: 500 }}>{s.name}</td>
                <td style={{ padding: "10px 14px", color: "#94a3b8" }}>{s.site_type}</td>
                <td style={{ padding: "10px 14px" }}>
                  <Tooltip text={s.assessment?.threshold_source || "NIOSH/OSHA thresholds"}>
                    <span style={{ padding: "2px 10px", borderRadius: 12, fontSize: 12, fontWeight: 600, color: "#fff", background: getRiskColor(s.assessment?.risk_bucket || "LOW") }}>
                      {s.assessment?.risk_bucket || "N/A"}
                    </span>
                  </Tooltip>
                </td>
                <td style={{ padding: "10px 14px", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{s.assessment?.temperature_c?.toFixed(1) || "\u2014"}</td>
                <td style={{ padding: "10px 14px", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{s.assessment?.heat_index?.toFixed(1) || "\u2014"}</td>
                <td style={{ padding: "10px 14px", textAlign: "right" }}>{s.assessment?.exceedance_hours?.toFixed(1) || "\u2014"}h</td>
                <td style={{ padding: "10px 14px", textAlign: "right" }}>{s.assessment?.persistence_hours?.toFixed(1) || "\u2014"}h</td>
                <td style={{ padding: "10px 14px" }}><button style={{ fontSize: 12, color: "#06b6d4", background: "none", border: "none", cursor: "pointer" }}>View {"\u2192"}</button></td>
              </tr>
            ))}
          </tbody>
        </table>
        {!siteData.length && <p style={{ padding: 24, textAlign: "center", color: "#475569" }}>No sites. Go to Setup.</p>}
      </div>

      <div style={{ marginTop: 20, background: "#111827", borderRadius: 12, padding: 20, border: "1px solid #1e293b" }}>
        <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Risk Distribution</h3>
        <RiskDistChart assessments={assessments} />
      </div>
    </div>
  );
}
