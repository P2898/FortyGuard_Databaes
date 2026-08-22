import { useState } from "react";
import * as api from "../lib/api";

export default function UploadScreen({ onDone }: { onDone: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [policy, setPolicy] = useState({ hazard_pay_rate_per_hr: 15, wage_rate_per_hr: 25, contract_day_rate: 5000 });
  const [uploading, setUploading] = useState(false);
  const [msg, setMsg] = useState("");

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    setMsg("");
    try {
      const text = await file.text();
      const res = await api.uploadCSV(text);
      setMsg(`Uploaded ${res.length} sites.`);
      await api.updatePolicy(policy);
      onDone();
    } catch (e: any) {
      setMsg(`Error: ${e.message}`);
    }
    setUploading(false);
  };

  return (
    <div style={{ maxWidth: 600, margin: "0 auto" }}>
      <h2 style={{ fontSize: 22, fontWeight: 700 }}>Site Setup</h2>
      <p style={{ color: "#94a3b8", marginTop: 4 }}>
        Upload CSV: <code>site_id, name, latitude, longitude, site_type</code>
      </p>
      <div style={{ marginTop: 24, display: "flex", flexDirection: "column", gap: 16 }}>
        <div>
          <label style={{ fontSize: 13, fontWeight: 600 }}>Site CSV</label>
          <input
            type="file"
            accept=".csv"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            style={{ marginTop: 4, display: "block", color: "#e2e8f0" }}
          />
        </div>
        <div
          style={{
            background: "#1e293b",
            borderRadius: 8,
            padding: 16,
            border: "1px solid #334155",
          }}
        >
          <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>
            Company Policy Rates
          </h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
            {(["hazard_pay_rate_per_hr", "wage_rate_per_hr", "contract_day_rate"] as const).map(
              (key) => (
                <div key={key}>
                  <label style={{ fontSize: 12, color: "#94a3b8" }}>
                    {key.replace(/_/g, " ")}
                  </label>
                  <input
                    type="number"
                    value={policy[key]}
                    onChange={(e) =>
                      setPolicy({ ...policy, [key]: +e.target.value })
                    }
                    style={{
                      width: "100%",
                      marginTop: 4,
                      border: "1px solid #334155",
                      borderRadius: 6,
                      padding: "6px 8px",
                      background: "#0f172a",
                      color: "#e2e8f0",
                    }}
                  />
                </div>
              )
            )}
          </div>
        </div>
        <button
          onClick={handleUpload}
          disabled={uploading || !file}
          style={{
            padding: "10px 20px",
            background: uploading || !file ? "#334155" : "#06b6d4",
            color: "#fff",
            borderRadius: 8,
            border: "none",
            cursor: "pointer",
            fontWeight: 600,
          }}
        >
          {uploading ? "Uploading..." : "Upload & Configure"}
        </button>
        {msg && (
          <p style={{ color: msg.startsWith("Error") ? "#ef4444" : "#22c55e", fontSize: 14 }}>
            {msg}
          </p>
        )}
      </div>
    </div>
  );
}
