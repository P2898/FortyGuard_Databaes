import { useState } from "react";
import { Site } from "../lib/api";

export default function ReportsScreen({ sites }: { sites: Site[] }) {
  const [scope, setScope] = useState<"site" | "company">("site");
  const [siteId, setSiteId] = useState("");
  const [generating, setGenerating] = useState(false);
  const [msg, setMsg] = useState("");

  const generate = async (format: "pdf" | "csv") => {
    setGenerating(true);
    setMsg("");
    try {
      const reportName = scope === "site" ? "SG-1_" + siteId : "SG-1_Company_Rollup";
      const content =
        "SiteGuard Heat Exposure Record - Form SG-1\n" +
        "Scope: " + scope + "\n" +
        "Site: " + (scope === "site" ? siteId : "All Sites") + "\n" +
        "Generated: " + new Date().toISOString() + "\n" +
        "Sites: " + sites.map((s) => s.site_id + " (" + s.name + ")").join(", ");
      const blob = new Blob([content], { type: format === "csv" ? "text/csv" : "text/plain" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = reportName + "." + format;
      a.click();
      URL.revokeObjectURL(url);
      setMsg("Report downloaded: " + reportName + "." + format);
    } catch (e: any) {
      setMsg("Error: " + e.message);
    }
    setGenerating(false);
  };

  return (
    <div>
      <h2 style={{ fontSize: 22, fontWeight: 700 }}>Compliance Reports</h2>
      <p style={{ color: "#94a3b8", marginTop: 2 }}>
        Generate OSHA-ready heat exposure records {"\u2014"} Form SG-1
      </p>
      <div
        style={{
          background: "#111827",
          borderRadius: 12,
          padding: 20,
          border: "1px solid #1e293b",
          marginTop: 20,
          maxWidth: 500,
        }}
      >
        <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
          {(["site", "company"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setScope(s)}
              style={{
                padding: "8px 16px",
                background: scope === s ? "#06b6d4" : "#1e293b",
                color: scope === s ? "#fff" : "#94a3b8",
                borderRadius: 6,
                border: "none",
                cursor: "pointer",
                fontWeight: 600,
              }}
            >
              {s === "site" ? "Site Report" : "Company Rollup"}
            </button>
          ))}
        </div>
        {scope === "site" && (
          <select
            value={siteId}
            onChange={(e) => setSiteId(e.target.value)}
            style={{
              width: "100%",
              padding: "8px 12px",
              border: "1px solid #334155",
              borderRadius: 6,
              marginBottom: 16,
              background: "#0f172a",
              color: "#e2e8f0",
            }}
          >
            <option value="">Select site...</option>
            {sites.map((s) => (
              <option key={s.site_id} value={s.site_id}>
                {s.name}
              </option>
            ))}
          </select>
        )}
        <div style={{ display: "flex", gap: 12 }}>
          <button
            onClick={() => generate("pdf")}
            disabled={generating || (scope === "site" && !siteId)}
            style={{
              padding: "8px 20px",
              background: "#ef4444",
              color: "#fff",
              borderRadius: 6,
              border: "none",
              cursor: "pointer",
              fontWeight: 600,
            }}
          >
            Generate PDF
          </button>
          <button
            onClick={() => generate("csv")}
            disabled={generating || (scope === "site" && !siteId)}
            style={{
              padding: "8px 20px",
              background: "#22c55e",
              color: "#fff",
              borderRadius: 6,
              border: "none",
              cursor: "pointer",
              fontWeight: 600,
            }}
          >
            Export CSV
          </button>
        </div>
        {msg && (
          <p style={{ color: msg.startsWith("Error") ? "#ef4444" : "#22c55e", fontSize: 14, marginTop: 12 }}>
            {msg}
          </p>
        )}
      </div>
    </div>
  );
}
