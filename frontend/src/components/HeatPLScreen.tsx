import { useState, useEffect } from "react";
import * as api from "../lib/api";

function Tooltip({ text, children }: { text: string; children: React.ReactNode }) {
  const [show, setShow] = useState(false);
  return (
    <span style={{ position: "relative", display: "inline-block", cursor: "help" }} onMouseEnter={() => setShow(true)} onMouseLeave={() => setShow(false)}>
      {children}
      {show && <span style={{ position: "absolute", bottom: "110%", left: "50%", transform: "translateX(-50%)", background: "#1f2937", color: "#fff", padding: "4px 8px", borderRadius: 4, fontSize: 11, whiteSpace: "nowrap", zIndex: 99 }}>{text}</span>}
    </span>
  );
}

export default function HeatPLScreen() {
  const [heatPL, setHeatPL] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getHeatPL().then(setHeatPL).catch(console.error).finally(() => setLoading(false));
  }, []);

  if (loading) return <p style={{ color: "#94a3b8" }}>Loading Heat P&L...</p>;
  if (!heatPL) return <p style={{ color: "#94a3b8", textAlign: "center", marginTop: 40 }}>No Heat P&L data.</p>;

  return (
    <div>
      <h2 style={{ fontSize: 22, fontWeight: 700 }}>Heat P&L</h2>
      <p style={{ color: "#94a3b8", marginTop: 2 }}>Financial impact of heat across your portfolio today</p>

      <div style={{ background: "linear-gradient(135deg, #0f172a, #1e293b)", color: "#fff", borderRadius: 12, padding: 28, marginTop: 20, textAlign: "center", border: "1px solid #334155" }}>
        <div style={{ fontSize: 14, opacity: 0.7 }}>Today, heat cost this portfolio's operations</div>
        <div style={{ fontSize: 48, fontWeight: 800, marginTop: 8, color: "#06b6d4" }}>${heatPL.total_cost?.toLocaleString()}</div>
        <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 4 }}>{heatPL.site_count} sites assessed</div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16, marginTop: 20 }}>
        {heatPL.lines?.map((line: any, i: number) => (
          <div key={i} style={{ background: "#111827", borderRadius: 12, padding: 20, border: "1px solid #1e293b" }}>
            <div style={{ fontSize: 13, color: "#94a3b8" }}>{line.label}</div>
            <div style={{ fontSize: 24, fontWeight: 700, marginTop: 4, color: line.amount > 0 ? "#f59e0b" : "#22c55e" }}>
              {line.amount > 0 ? "$" + line.amount.toLocaleString() : line.label === "Compliance readiness" ? "Active" : "$0"}
            </div>
            <Tooltip text={line.formula}>
              <div style={{ fontSize: 11, color: "#64748b", marginTop: 8, cursor: "help", textDecoration: "underline dotted" }}>Why this number?</div>
            </Tooltip>
            {line.disclaimer && <div style={{ fontSize: 11, color: "#475569", marginTop: 4 }}>{line.disclaimer}</div>}
          </div>
        ))}
      </div>
    </div>
  );
}
