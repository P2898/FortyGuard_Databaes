import { useState } from "react";
import { Site, generateReport, generateCSVReport } from "../lib/api";
import { useTheme } from "../lib/theme";

export default function ReportsScreen({ sites }: { sites: Site[] }) {
  const { colors } = useTheme();
  const [scope, setScope] = useState<"site" | "company">("site");
  const [siteId, setSiteId] = useState("");
  const [generating, setGenerating] = useState(false);
  const [msg, setMsg] = useState("");

  const downloadBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const generate = async (format: "pdf" | "csv") => {
    if (scope === "site" && !siteId) return;
    setGenerating(true);
    setMsg("");
    try {
      const req = { scope, site_id: scope === "site" ? siteId : undefined };
      const blob = format === "pdf" ? await generateReport(req) : await generateCSVReport(req);
      const reportName = `Shade_Heat_Exposure_Record_SG-1_${scope === "site" ? siteId : "Company"}_${new Date().toISOString().slice(0, 10)}`;
      downloadBlob(blob, `${reportName}.${format}`);
      setMsg(`Report downloaded: ${reportName}.${format}`);
    } catch (e: any) {
      setMsg(`Error: ${e.message}`);
    }
    setGenerating(false);
  };

  return (
    <div>
      <h2 style={{ fontSize: 22, fontWeight: 700, color: colors.text }}>Compliance Reports</h2>
      <p style={{ color: colors.textSecondary, marginTop: 2 }}>
        Generate OSHA-ready heat exposure records {"\u2014"} Form SG-1
      </p>

      <div
        style={{
          background: colors.surface,
          borderRadius: 12,
          padding: 24,
          border: `1px solid ${colors.border}`,
          marginTop: 20,
          maxWidth: 560,
        }}
      >
        {/* Scope selector */}
        <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
          {(["site", "company"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setScope(s)}
              style={{
                padding: "10px 20px",
                background: scope === s ? colors.accent : colors.surfaceHover,
                color: scope === s ? "#fff" : colors.textSecondary,
                borderRadius: 8,
                border: scope === s ? `1px solid ${colors.accent}` : `1px solid ${colors.borderLight}`,
                cursor: "pointer",
                fontWeight: 600,
                fontSize: 14,
                transition: "all 0.15s",
              }}
            >
              {s === "site" ? "📋 Site Report" : "🏢 Company Rollup"}
            </button>
          ))}
        </div>

        {/* Site selector */}
        {scope === "site" && (
          <div style={{ marginBottom: 20 }}>
            <label style={{ fontSize: 13, color: colors.textSecondary, display: "block", marginBottom: 6 }}>
              Select site for report
            </label>
            <select
              value={siteId}
              onChange={(e) => setSiteId(e.target.value)}
              style={{
                width: "100%",
                padding: "10px 14px",
                border: `1px solid ${colors.borderLight}`,
                borderRadius: 8,
                background: colors.bg,
                color: colors.text,
                fontSize: 14,
              }}
            >
              <option value="">Select site...</option>
              {sites.map((s) => (
                <option key={s.site_id} value={s.site_id}>
                  {s.name} ({s.site_id})
                </option>
              ))}
            </select>
          </div>
        )}

        {scope === "company" && (
          <div
            style={{
              padding: "12px 16px",
              background: colors.bg,
              borderRadius: 8,
              border: `1px solid ${colors.border}`,
              marginBottom: 20,
              fontSize: 13,
              color: colors.textSecondary,
            }}
          >
            Company rollup will include all {sites.length} sites in a single report with summary + individual site sections.
          </div>
        )}

        {/* Generate buttons */}
        <div style={{ display: "flex", gap: 12 }}>
          <button
            onClick={() => generate("pdf")}
            disabled={generating || (scope === "site" && !siteId)}
            style={{
              padding: "10px 24px",
              background: generating || (scope === "site" && !siteId) ? colors.borderLight : "#dc2626",
              color: "#fff",
              borderRadius: 8,
              border: "none",
              cursor: "pointer",
              fontWeight: 600,
              fontSize: 14,
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            {generating ? "Generating..." : "📄 Generate PDF"}
          </button>
          <button
            onClick={() => generate("csv")}
            disabled={generating || (scope === "site" && !siteId)}
            style={{
              padding: "10px 24px",
              background: generating || (scope === "site" && !siteId) ? colors.borderLight : "#16a34a",
              color: "#fff",
              borderRadius: 8,
              border: "none",
              cursor: "pointer",
              fontWeight: 600,
              fontSize: 14,
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            {generating ? "Generating..." : "📊 Export CSV"}
          </button>
        </div>

        {msg && (
          <div
            style={{
              marginTop: 16,
              padding: "10px 14px",
              borderRadius: 8,
              fontSize: 14,
              background: msg.startsWith("Error") ? "#7f1d1d" : "#064e3b",
              color: msg.startsWith("Error") ? "#fca5a5" : "#6ee7b7",
            }}
          >
            {msg}
          </div>
        )}
      </div>

      {/* Report info */}
      <div style={{ marginTop: 24, maxWidth: 560, fontSize: 13, color: colors.textMuted, lineHeight: 1.6 }}>
        <p><strong style={{ color: colors.textSecondary }}>About Form SG-1:</strong> The Shade Heat Exposure Record captures risk assessments, exceedance/persistence data, and threshold sources for OSHA compliance readiness.</p>
        <p style={{ marginTop: 8 }}><strong style={{ color: colors.textSecondary }}>PDF report includes:</strong> Risk distribution summary, detailed assessments table, sourced thresholds, and compliance metadata.</p>
        <p style={{ marginTop: 8 }}><strong style={{ color: colors.textSecondary }}>CSV report includes:</strong> All assessment data in spreadsheet-compatible format for custom analysis.</p>
      </div>
    </div>
  );
}
