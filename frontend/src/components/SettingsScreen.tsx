import { useState } from "react";
import { Policy } from "../lib/api";

export default function SettingsScreen({ policy, onSave }: { policy: Policy; onSave: (p: Policy) => void }) {
  const [local, setLocal] = useState(policy);
  const [voice, setVoice] = useState(localStorage.getItem("shade_voice") || "default");
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    onSave(local);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div>
      <h2 style={{ fontSize: 22, fontWeight: 700 }}>Settings</h2>
      <div
        style={{
          background: "#111827",
          borderRadius: 12,
          padding: 24,
          border: "1px solid #1e293b",
          marginTop: 20,
          maxWidth: 500,
        }}
      >
        <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>
          Company Policy
        </h3>
        <div style={{ display: "grid", gap: 12 }}>
          {(["hazard_pay_rate_per_hr", "wage_rate_per_hr", "contract_day_rate"] as const).map(
            (key) => (
              <div key={key}>
                <label style={{ fontSize: 13, fontWeight: 500, color: "#94a3b8" }}>
                  {key.replace(/_/g, " ")}
                </label>
                <input
                  type="number"
                  value={local[key]}
                  onChange={(e) => setLocal({ ...local, [key]: +e.target.value })}
                  style={{
                    width: "100%",
                    marginTop: 4,
                    border: "1px solid #334155",
                    borderRadius: 6,
                    padding: "6px 10px",
                    background: "#0f172a",
                    color: "#e2e8f0",
                  }}
                />
              </div>
            )
          )}
        </div>

        <h3 style={{ fontSize: 16, fontWeight: 600, marginTop: 24, marginBottom: 12 }}>
          Kelvin Voice
        </h3>
        <div style={{ display: "flex", gap: 8 }}>
          {(["default", "A", "B"] as const).map((v) => (
            <button
              key={v}
              onClick={() => {
                setVoice(v);
                localStorage.setItem("shade_voice", v);
              }}
              style={{
                padding: "6px 16px",
                background: voice === v ? "#06b6d4" : "#1e293b",
                color: voice === v ? "#fff" : "#94a3b8",
                borderRadius: 6,
                border: "none",
                cursor: "pointer",
              }}
            >
              {v === "default" ? "Default" : "Voice " + v}
            </button>
          ))}
        </div>

        <button
          onClick={handleSave}
          style={{
            marginTop: 20,
            padding: "10px 24px",
            background: saved ? "#22c55e" : "#06b6d4",
            color: "#fff",
            borderRadius: 8,
            border: "none",
            cursor: "pointer",
            fontWeight: 600,
          }}
        >
          {saved ? "\u2713 Saved" : "Save Settings"}
        </button>
      </div>
    </div>
  );
}
