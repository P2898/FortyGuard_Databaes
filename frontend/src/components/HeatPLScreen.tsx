import { useState, useEffect, useRef } from "react";
import * as api from "../lib/api";
import { useTheme } from "../lib/theme";

function AnimatedNumber({ value, prefix = "$" }: { value: number; prefix?: string }) {
  const [display, setDisplay] = useState(0);
  const ref = useRef<number | null>(null);

  useEffect(() => {
    const start = display;
    const end = value;
    const duration = 800;
    const startTime = Date.now();

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(start + (end - start) * eased);
      if (progress < 1) {
        ref.current = requestAnimationFrame(animate);
      }
    };
    ref.current = requestAnimationFrame(animate);
    return () => { if (ref.current) cancelAnimationFrame(ref.current); };
  }, [value]);

  return <span>{prefix}{display.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>;
}

function ExpandableCard({ line, colors }: { line: any; colors: any }) {
  const [expanded, setExpanded] = useState(false);
  const isCompliance = line.label === "Compliance readiness";

  return (
    <div
      style={{
        background: colors.surface,
        borderRadius: 12,
        padding: 20,
        border: `1px solid ${colors.border}`,
        transition: "border-color 0.2s",
      }}
    >
      <div style={{ fontSize: 13, color: colors.textSecondary, marginBottom: 4 }}>{line.label}</div>
      <div
        style={{
          fontSize: 28,
          fontWeight: 700,
          color: isCompliance ? "#22c55e" : line.amount > 0 ? "#f59e0b" : "#22c55e",
        }}
      >
        {isCompliance ? "Active" : line.amount > 0 ? <AnimatedNumber value={line.amount} /> : "$0"}
      </div>

      <button
        onClick={() => setExpanded(!expanded)}
        style={{
          fontSize: 12,
          color: colors.textMuted,
          marginTop: 8,
          cursor: "pointer",
          background: "none",
          border: "none",
          padding: 0,
          textDecoration: "underline dotted",
          display: "flex",
          alignItems: "center",
          gap: 4,
        }}
      >
        Why this number? {"\u25B2"}
      </button>

      {expanded && (
        <div
          style={{
            marginTop: 10,
            padding: 12,
            background: colors.bg,
            borderRadius: 8,
            border: `1px solid ${colors.border}`,
            fontSize: 12,
            lineHeight: 1.6,
          }}
        >
          <div style={{ color: colors.text, fontWeight: 600, marginBottom: 4 }}>Formula</div>
          <div style={{ color: colors.textSecondary }}>{line.formula}</div>
          {line.disclaimer && (
            <div style={{ marginTop: 8, color: colors.textMuted, fontStyle: "italic" }}>
              {decodeEscaped(line.disclaimer)}
            </div>
          )}
          {line.inputs && Object.keys(line.inputs).length > 0 && (
            <div style={{ marginTop: 8 }}>
              <div style={{ color: colors.text, fontWeight: 600, marginBottom: 4 }}>Inputs</div>
              {Object.entries(line.inputs).map(([k, v]) => (
                <div key={k} style={{ color: colors.textSecondary }}>
                  {k.replace(/_/g, " ")}: {String(v)}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const DEG = String.fromCharCode(176);

/** Decode any escaped unicode (e.g. \u00b0) from API responses */
function decodeEscaped(s: string): string {
  return s.replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
}

export default function HeatPLScreen() {
  const { colors } = useTheme();
  const [heatPL, setHeatPL] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .getHeatPL()
      .then(setHeatPL)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading)
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 300 }}>
        <div style={{ color: colors.textSecondary, fontSize: 14 }}>Computing Heat P&L...</div>
      </div>
    );
  if (!heatPL)
    return (
      <div style={{ textAlign: "center", marginTop: 60, color: colors.textDim }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>$0</div>
        <div style={{ color: colors.textSecondary }}>Run a fleet assessment first to compute Heat P&L.</div>
      </div>
    );

  const complianceLine = heatPL.lines?.find((l: any) => l.label === "Compliance readiness");
  const financialLines = heatPL.lines?.filter((l: any) => l.label !== "Compliance readiness") || [];

  return (
    <div>
      <h2 style={{ fontSize: 22, fontWeight: 700, color: colors.text }}>Heat P&L</h2>
      <p style={{ color: colors.textSecondary, marginTop: 2 }}>
        Financial impact of heat across your portfolio today
      </p>

      {/* Headline card */}
      <div
        style={{
          background: `linear-gradient(135deg, ${colors.surface}, ${colors.surfaceHover})`,
          color: "#fff",
          borderRadius: 16,
          padding: 32,
          marginTop: 20,
          textAlign: "center",
          border: `1px solid ${colors.borderLight}`,
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: -40,
            right: -40,
            width: 120,
            height: 120,
            borderRadius: "50%",
            background: "radial-gradient(circle, #c07a2820, transparent)",
          }}
        />
        <div style={{ fontSize: 14, opacity: 0.7 }}>
          Today, heat cost this portfolio's operations
        </div>
        <div style={{ fontSize: 56, fontWeight: 800, marginTop: 8, color: colors.accent, position: "relative" }}>
          <AnimatedNumber value={heatPL.total_cost} />
        </div>
        <div style={{ fontSize: 13, color: colors.textSecondary, marginTop: 6 }}>
          {heatPL.site_count} sites assessed {"\u00B7"} {heatPL.date}
        </div>
      </div>

      {/* Financial line items */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
          gap: 16,
          marginTop: 20,
        }}
      >
        {financialLines.map((line: any, i: number) => (
          <ExpandableCard key={i} line={line} colors={colors} />
        ))}
      </div>

      {/* Compliance status */}
      {complianceLine && (
        <div
          style={{
            marginTop: 16,
            background: "#064e3b",
            borderRadius: 12,
            padding: 20,
            border: "1px solid #059669",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div
              style={{
                width: 10,
                height: 10,
                borderRadius: "50%",
                background: "#22c55e",
              }}
            />
            <span style={{ fontSize: 14, fontWeight: 600, color: "#6ee7b7" }}>
              Compliance Readiness: Active
            </span>
          </div>
          <div style={{ fontSize: 13, color: "#a7f3d0", marginTop: 6 }}>
            {decodeEscaped(complianceLine.disclaimer)}
          </div>
        </div>
      )}

      {/* Source info */}
      <div
        style={{
          marginTop: 20,
          padding: 16,
          background: colors.surface,
          borderRadius: 8,
          border: `1px solid ${colors.border}`,
          fontSize: 12,
          color: colors.textMuted,
          lineHeight: 1.6,
        }}
      >
        <strong style={{ color: colors.textSecondary }}>What's real vs. estimated:</strong>{" "}
        Hazard pay and delay claim values are computed from your company-entered rates and real FortyGuard risk data.
        Productivity savings use the SF Fed/Duke research relationship (workers lose ~1hr/day above 85{DEG}F vs 76-80{DEG}F),
        labeled as an estimate. Compliance readiness tracks status only, not estimated fine avoidance.
      </div>
    </div>
  );
}
