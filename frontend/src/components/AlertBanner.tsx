import { Assessment } from "../lib/api";

const RISK_COLORS: Record<string, string> = {
  CRITICAL: "#ef4444",
  HIGH: "#f97316",
  MEDIUM: "#eab308",
  LOW: "#22c55e",
};

const RISK_BG: Record<string, string> = {
  CRITICAL: "rgba(239, 68, 68, 0.12)",
  HIGH: "rgba(249, 115, 22, 0.10)",
  MEDIUM: "rgba(234, 179, 8, 0.08)",
  LOW: "transparent",
};

export default function AlertBanner({
  assessments,
  onSelectSite,
}: {
  assessments: Assessment[];
  onSelectSite: (id: string) => void;
}) {
  if (!assessments.length) return null;

  // Find highest risk site
  const RISK_ORDER: Record<string, number> = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };
  const sorted = [...assessments].sort(
    (a, b) => (RISK_ORDER[b.risk_bucket] || 0) - (RISK_ORDER[a.risk_bucket] || 0)
  );
  const top = sorted[0];

  // Only show for CRITICAL or HIGH
  if (top.risk_bucket !== "CRITICAL" && top.risk_bucket !== "HIGH") return null;

  const isCritical = top.risk_bucket === "CRITICAL";
  const color = RISK_COLORS[top.risk_bucket];

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "10px 24px",
        background: RISK_BG[top.risk_bucket],
        borderBottom: `1px solid ${color}30`,
        gap: 12,
        flexWrap: "wrap",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
        {/* Pulsing dot */}
        <span
          style={{
            width: 10,
            height: 10,
            borderRadius: "50%",
            background: color,
            flexShrink: 0,
            animation: isCritical ? "pulse 1.5s ease-in-out infinite" : "none",
            boxShadow: isCritical ? `0 0 8px ${color}80` : "none",
          }}
        />
        <span style={{ fontSize: 13, fontWeight: 600, color }}>
          {isCritical ? "CRITICAL" : "HIGH"} RISK
        </span>
        <span style={{ fontSize: 13, color: "#94a3b8" }}>—</span>
        <span style={{ fontSize: 13, color: "#e2e8f0", fontWeight: 500 }}>
          {top.name}
        </span>
        <span style={{ fontSize: 12, color: "#64748b" }}>
          {top.temperature_c.toFixed(1)}°C · Heat Index {top.heat_index.toFixed(1)}
        </span>
        {top.exceedance_hours > 0 && (
          <span
            style={{
              fontSize: 11,
              color,
              background: `${color}20`,
              padding: "2px 8px",
              borderRadius: 8,
              fontWeight: 600,
            }}
          >
            {top.exceedance_hours.toFixed(1)}h exceedance
          </span>
        )}
      </div>
      <button
        onClick={() => onSelectSite(top.site_id)}
        style={{
          fontSize: 12,
          fontWeight: 600,
          color: "#fff",
          background: color,
          border: "none",
          borderRadius: 6,
          padding: "6px 14px",
          cursor: "pointer",
          whiteSpace: "nowrap",
          transition: "opacity 0.15s",
        }}
        onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.85")}
        onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
      >
        View Details →
      </button>
    </div>
  );
}
