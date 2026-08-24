import { useState, useEffect, useRef } from "react";
import * as api from "../lib/api";

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
      const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
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
        <span
          style={{
            position: "absolute",
            bottom: "110%",
            left: "50%",
            transform: "translateX(-50%)",
            background: "#1f2937",
            color: "#e2e8f0",
            padding: "8px 12px",
            borderRadius: 6,
            fontSize: 12,
            zIndex: 99,
            boxShadow: "0 4px 12px rgba(0,0,0,.4)",
            border: "1px solid #334155",
            maxWidth: 320,
            whiteSpace: "normal",
          }}
        >
          {text}
        </span>
      )}
    </span>
  );
}

function ExpandableCard({ line }: { line: any }) {
  const [expanded, setExpanded] = useState(false);
  const isCompliance = line.label === "Compliance readiness";

  return (
    <div
      style={{
        background: "#111827",
        borderRadius: 12,
        padding: 20,
        border: "1px solid #1e293b",
        transition: "border-color 0.2s",
      }}
    >
      <div style={{ fontSize: 13, color: "#94a3b8", marginBottom: 4 }}>{line.label}</div>
      <div
        style={{
          fontSize: 28,
          fontWeight: 700,
          color: isCompliance ? "#22c55e" : line.amount > 0 ? "#f59e0b" : "#22c55e",
        }}
      >
        {isCompliance ? "Active" : line.amount > 0 ? <AnimatedNumber value={line.amount} /> : "$0"}
      </div>

      {/* Why this number? */}
      <button
        onClick={() => setExpanded(!expanded)}
        style={{
          fontSize: 12,
          color: "#64748b",
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
        Why this number? {expanded ? "\u25B2" : "\u25BC"}
      </button>

      {expanded && (
        <div
          style={{
            marginTop: 10,
            padding: 12,
            background: "#0f172a",
            borderRadius: 8,
            border: "1px solid #1e293b",
            fontSize: 12,
            lineHeight: 1.6,
          }}
        >
          <div style={{ color: "#e2e8f0", fontWeight: 600, marginBottom: 4 }}>Formula</div>
          <div style={{ color: "#94a3b8" }}>{line.formula}</div>
          {line.disclaimer && (
            <div style={{ marginTop: 8, color: "#64748b", fontStyle: "italic" }}>
              {line.disclaimer}
            </div>
          )}
          {line.inputs && Object.keys(line.inputs).length > 0 && (
            <div style={{ marginTop: 8 }}>
              <div style={{ color: "#e2e8f0", fontWeight: 600, marginBottom: 4 }}>Inputs</div>
              {Object.entries(line.inputs).map(([k, v]) => (
                <div key={k} style={{ color: "#94a3b8" }}>
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

export default function HeatPLScreen() {
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
        <div style={{ color: "#94a3b8", fontSize: 14 }}>Computing Heat P&L...</div>
      </div>
    );
  if (!heatPL)
    return (
      <div style={{ textAlign: "center", marginTop: 60, color: "#475569" }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>$0</div>
        <div>Run a fleet assessment first to compute Heat P&L.</div>
      </div>
    );

  const complianceLine = heatPL.lines?.find((l: any) => l.label === "Compliance readiness");
  const financialLines = heatPL.lines?.filter((l: any) => l.label !== "Compliance readiness") || [];

  return (
    <div>
      <h2 style={{ fontSize: 22, fontWeight: 700 }}>Heat P&L</h2>
      <p style={{ color: "#94a3b8", marginTop: 2 }}>
        Financial impact of heat across your portfolio today
      </p>

      {/* Headline card */}
      <div
        style={{
          background: "linear-gradient(135deg, #0f172a, #1e293b)",
          color: "#fff",
          borderRadius: 16,
          padding: 32,
          marginTop: 20,
          textAlign: "center",
          border: "1px solid #334155",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Decorative gradient orb */}
        <div
          style={{
            position: "absolute",
            top: -40,
            right: -40,
            width: 120,
            height: 120,
            borderRadius: "50%",
            background: "radial-gradient(circle, #06b6d420, transparent)",
          }}
        />
        <div style={{ fontSize: 14, opacity: 0.7 }}>
          Today, heat cost this portfolio's operations
        </div>
        <div style={{ fontSize: 56, fontWeight: 800, marginTop: 8, color: "#06b6d4", position: "relative" }}>
          <AnimatedNumber value={heatPL.total_cost} />
        </div>
        <div style={{ fontSize: 13, color: "#94a3b8", marginTop: 6 }}>
          {heatPL.site_count} sites assessed {"\u00b7"} {heatPL.date}
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
          <ExpandableCard key={i} line={line} />
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
            {complianceLine.disclaimer}
          </div>
        </div>
      )}

      {/* Source info */}
      <div
        style={{
          marginTop: 20,
          padding: 16,
          background: "#111827",
          borderRadius: 8,
          border: "1px solid #1e293b",
          fontSize: 12,
          color: "#64748b",
          lineHeight: 1.6,
        }}
      >
        <strong style={{ color: "#94a3b8" }}>What's real vs. estimated:</strong>{" "}
        Hazard pay and delay claim values are computed from your company-entered rates and real FortyGuard risk data.
        Productivity savings use the SF Fed/Duke research relationship (workers lose ~1hr/day above 85\u00b0F vs 76-80\u00b0F),
        labeled as an estimate. Compliance readiness tracks status only, not estimated fine avoidance.
      </div>
    </div>
  );
}
