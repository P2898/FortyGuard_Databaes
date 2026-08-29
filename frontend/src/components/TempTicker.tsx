import { useTheme } from "../lib/theme";
import { Site, Assessment } from "../lib/api";
import { formatTemperature } from "./helpers";

const RISK_COLORS: Record<string, string> = {
  CRITICAL: "#ef4444",
  HIGH: "#f97316",
  MEDIUM: "#eab308",
  LOW: "#22c55e",
};

interface Props {
  sites: Site[];
  assessments: Assessment[];
}

export default function TempTicker({ sites, assessments }: Props) {
  const { colors } = useTheme();

  if (!sites.length || !assessments.length) return null;

  // Build items
  const items = sites.map((s) => {
    const a = assessments.find((x) => x.site_id === s.site_id);
    return {
      name: s.name,
      temp: a?.temperature_c ?? 0,
      risk: a?.risk_bucket ?? "LOW",
    };
  });

  // Duplicate for seamless loop
  const doubled = [...items, ...items];

  return (
    <div
      style={{
        background: colors.surface,
        borderBottom: `1px solid ${colors.border}`,
        overflow: "hidden",
        height: 36,
        display: "flex",
        alignItems: "center",
        position: "relative",
      }}
    >
      {/* Fade edges */}
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          bottom: 0,
          width: 40,
          background: `linear-gradient(to right, ${colors.surface}, transparent)`,
          zIndex: 2,
        }}
      />
      <div
        style={{
          position: "absolute",
          right: 0,
          top: 0,
          bottom: 0,
          width: 40,
          background: `linear-gradient(to left, ${colors.surface}, transparent)`,
          zIndex: 2,
        }}
      />

      {/* Scrolling content */}
      <div
        style={{
          display: "flex",
          gap: 32,
          whiteSpace: "nowrap",
          animation: `tickerScroll ${items.length * 4}s linear infinite`,
        }}
      >
        {doubled.map((item, i) => (
          <span
            key={i}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              fontSize: 12,
              color: colors.textSecondary,
            }}
          >
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: RISK_COLORS[item.risk],
                flexShrink: 0,
              }}
            />
            <span style={{ fontWeight: 500, color: colors.text }}>
              {item.name}
            </span>
            <span style={{ color: RISK_COLORS[item.risk], fontWeight: 600 }}>
              {formatTemperature(item.temp, false)}
            </span>
            <span style={{ color: colors.textMuted }}>
              / {((item.temp * 9) / 5 + 32).toFixed(0)}°F
            </span>
          </span>
        ))}
      </div>

      <style>{`
        @keyframes tickerScroll {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
      `}</style>
    </div>
  );
}
