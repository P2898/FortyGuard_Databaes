import { useState } from "react";
import { Policy } from "../lib/api";
import { RouteAvatar, AvatarGender, AvatarOutfit } from "./RouteAvatar";

export default function SettingsScreen({ policy, onSave }: { policy: Policy; onSave: (p: Policy) => void }) {
  const [local, setLocal] = useState(policy);
  const [voice, setVoice] = useState(localStorage.getItem("shade_voice") || "default");
  const [avatarGender, setAvatarGender] = useState<AvatarGender>((localStorage.getItem("shade_avatar_gender") as AvatarGender) || "default");
  const [avatarOutfit, setAvatarOutfit] = useState<AvatarOutfit>((localStorage.getItem("shade_avatar_outfit") as AvatarOutfit) || "default");
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    onSave(local);
    localStorage.setItem("shade_voice", voice);
    localStorage.setItem("shade_avatar_gender", avatarGender);
    localStorage.setItem("shade_avatar_outfit", avatarOutfit);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const genderStates = avatarGender === "B" ? "attention" : "calm";

  return (
    <div>
      <h2 style={{ fontSize: 22, fontWeight: 700 }}>Settings</h2>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginTop: 20, maxWidth: 800 }}>
        {/* Company Policy */}
        <div style={{ background: "#111827", borderRadius: 12, padding: 24, border: "1px solid #1e293b" }}>
          <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>Company Policy</h3>
          <div style={{ display: "grid", gap: 12 }}>
            {(["hazard_pay_rate_per_hr", "wage_rate_per_hr", "contract_day_rate"] as const).map((key) => (
              <div key={key}>
                <label style={{ fontSize: 13, fontWeight: 500, color: "#94a3b8" }}>{key.replace(/_/g, " ")}</label>
                <input type="number" value={local[key]} onChange={(e) => setLocal({ ...local, [key]: +e.target.value })}
                  style={{ width: "100%", marginTop: 4, border: "1px solid #334155", borderRadius: 6, padding: "6px 10px", background: "#0f172a", color: "#e2e8f0" }} />
              </div>
            ))}
          </div>
        </div>

        {/* Voice + Avatar */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {/* Voice */}
          <div style={{ background: "#111827", borderRadius: 12, padding: 24, border: "1px solid #1e293b" }}>
            <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>Kelvin Voice</h3>
            <div style={{ display: "flex", gap: 8 }}>
              {(["default", "A", "B"] as const).map((v) => (
                <button key={v} onClick={() => setVoice(v)}
                  style={{ padding: "8px 16px", background: voice === v ? "#06b6d4" : "#1e293b", color: voice === v ? "#fff" : "#94a3b8", borderRadius: 6, border: "none", cursor: "pointer" }}>
                  {v === "default" ? "Default" : v === "A" ? "Voice A (Female)" : "Voice B (Male)"}
                </button>
              ))}
            </div>
          </div>

          {/* Route Avatar */}
          <div style={{ background: "#111827", borderRadius: 12, padding: 24, border: "1px solid #1e293b" }}>
            <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>Route Avatar</h3>
            <p style={{ fontSize: 13, color: "#94a3b8", marginBottom: 12 }}>
              Choose the worker figure for route playback animation
            </p>

            <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
              {/* Avatar preview */}
              <div style={{ background: "#0f172a", borderRadius: 12, padding: 16, border: "1px solid #1e293b", textAlign: "center" }}>
                <RouteAvatar gender={avatarGender} outfit={avatarOutfit} state={genderStates as any} size={80} />
                <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 8 }}>Preview</div>
              </div>

              {/* Options */}
              <div style={{ flex: 1 }}>
                {/* Gender */}
                <div style={{ marginBottom: 12 }}>
                  <label style={{ fontSize: 13, fontWeight: 500, color: "#94a3b8", display: "block", marginBottom: 6 }}>Presentation</label>
                  <div style={{ display: "flex", gap: 8 }}>
                    {([
                      { value: "A" as AvatarGender, label: "Voice A" },
                      { value: "B" as AvatarGender, label: "Voice B" },
                      { value: "default" as AvatarGender, label: "Default" },
                    ]).map((opt) => (
                      <button key={opt.value} onClick={() => setAvatarGender(opt.value)}
                        style={{ padding: "6px 14px", background: avatarGender === opt.value ? "#06b6d4" : "#1e293b", color: avatarGender === opt.value ? "#fff" : "#94a3b8", borderRadius: 6, border: "none", cursor: "pointer", fontSize: 13 }}>
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Outfit */}
                <div>
                  <label style={{ fontSize: 13, fontWeight: 500, color: "#94a3b8", display: "block", marginBottom: 6 }}>Outfit</label>
                  <div style={{ display: "flex", gap: 8 }}>
                    {([
                      { value: "construction" as AvatarOutfit, label: "\uD83D\uDEE1 Construction (hi-vis)" },
                      { value: "delivery" as AvatarOutfit, label: "\uD83D\uDCE6 Delivery" },
                      { value: "default" as AvatarOutfit, label: "Default" },
                    ]).map((opt) => (
                      <button key={opt.value} onClick={() => setAvatarOutfit(opt.value)}
                        style={{ padding: "6px 14px", background: avatarOutfit === opt.value ? "#06b6d4" : "#1e293b", color: avatarOutfit === opt.value ? "#fff" : "#94a3b8", borderRadius: 6, border: "none", cursor: "pointer", fontSize: 13, whiteSpace: "nowrap" }}>
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <button onClick={handleSave}
        style={{ marginTop: 20, padding: "10px 24px", background: saved ? "#22c55e" : "#06b6d4", color: "#fff", borderRadius: 8, border: "none", cursor: "pointer", fontWeight: 600, fontSize: 14 }}>
        {saved ? "\u2713 Saved" : "Save Settings"}
      </button>
    </div>
  );
}
