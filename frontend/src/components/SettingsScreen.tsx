import { useState } from "react";
import { Policy } from "../lib/api";
import { RouteAvatar, AvatarGender, AvatarOutfit } from "./RouteAvatar";
import { useTheme } from "../lib/theme";

const inputStyle = (colors: any): React.CSSProperties => ({
  width: "100%",
  marginTop: 6,
  border: `1px solid ${colors.borderLight}`,
  borderRadius: 8,
  padding: "10px 14px",
  background: colors.bg,
  color: colors.text,
  fontSize: 15,
  outline: "none",
  transition: "border-color 0.2s",
});

const labelStyle = (colors: any): React.CSSProperties => ({
  fontSize: 13,
  fontWeight: 500,
  color: colors.textSecondary,
  textTransform: "capitalize" as const,
  letterSpacing: "0.02em",
});

const cardStyle = (colors: any): React.CSSProperties => ({
  background: colors.surface,
  borderRadius: 16,
  padding: 28,
  border: `1px solid ${colors.border}`,
  boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
});

const toggleBtn = (active: boolean, colors: any): React.CSSProperties => ({
  padding: "10px 20px",
  background: active ? colors.accent : colors.surfaceHover,
  color: active ? "#fff" : colors.textSecondary,
  borderRadius: 8,
  border: "none",
  cursor: "pointer",
  fontWeight: active ? 600 : 400,
  fontSize: 14,
  transition: "all 0.15s ease",
});

const fields = [
  { key: "hazard_pay_rate_per_hr" as const, label: "Hazard Pay Rate / hr", icon: "⚠️" },
  { key: "wage_rate_per_hr" as const, label: "Wage Rate / hr", icon: "💵" },
  { key: "contract_day_rate" as const, label: "Contract Day Rate", icon: "📋" },
];

const voices = [
  { value: "default" as const, label: "Default", desc: "System voice" },
  { value: "A" as const, label: "Voice A", desc: "Female" },
  { value: "B" as const, label: "Voice B", desc: "Male" },
];

const presentations = [
  { value: "A" as AvatarGender, label: "Female" },
  { value: "B" as AvatarGender, label: "Male" },
  { value: "default" as AvatarGender, label: "Default" },
];

const outfits = [
  { value: "construction" as AvatarOutfit, label: "Construction", icon: "🛡️", desc: "Hi-vis" },
  { value: "delivery" as AvatarOutfit, label: "Delivery", icon: "📦", desc: "Standard" },
  { value: "default" as AvatarOutfit, label: "Default", icon: "👷", desc: "Worker" },
];

export default function SettingsScreen({ policy, onSave }: { policy: Policy; onSave: (p: Policy) => void }) {
  const { colors } = useTheme();
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
    <div style={{ maxWidth: 960 }}>
      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 28, fontWeight: 700, color: colors.text, margin: 0, letterSpacing: "-0.02em" }}>
          ⚙️ Settings
        </h2>
        <p style={{ fontSize: 14, color: colors.textSecondary, marginTop: 6, marginBottom: 0 }}>
          Configure company policy, voice, and worker appearance
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
        {/* ─── Company Policy ─── */}
        <div style={cardStyle(colors)}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 20 }}>
            <span style={{ fontSize: 20 }}>🏢</span>
            <h3 style={{ fontSize: 17, fontWeight: 600, color: colors.text, margin: 0 }}>Company Policy</h3>
          </div>

          <div style={{ display: "grid", gap: 16 }}>
            {fields.map(({ key, label, icon }) => (
              <div key={key}>
                <label style={labelStyle(colors)}>
                  <span style={{ marginRight: 6 }}>{icon}</span>{label}
                </label>
                <input
                  type="number"
                  value={local[key]}
                  onChange={(e) => setLocal({ ...local, [key]: +e.target.value })}
                  style={inputStyle(colors)}
                  onFocus={(e) => (e.currentTarget.style.borderColor = colors.accent)}
                  onBlur={(e) => (e.currentTarget.style.borderColor = colors.borderLight)}
                />
              </div>
            ))}
          </div>

          <div style={{ marginTop: 20, padding: "10px 14px", background: colors.bg, borderRadius: 8, border: `1px solid ${colors.border}` }}>
            <p style={{ fontSize: 12, color: colors.textSecondary, margin: 0, lineHeight: 1.5 }}>
              💡 These rates are used to compute <strong>Heat P&L</strong> financial impact (hazard pay, delay claims, productivity loss).
            </p>
          </div>
        </div>

        {/* ─── Right Column ─── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          {/* Voice */}
          <div style={cardStyle(colors)}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
              <span style={{ fontSize: 20 }}>🎙️</span>
              <h3 style={{ fontSize: 17, fontWeight: 600, color: colors.text, margin: 0 }}>Kelvin Voice</h3>
            </div>

            <div style={{ display: "flex", gap: 10 }}>
              {voices.map((v) => (
                <button
                  key={v.value}
                  onClick={() => setVoice(v.value)}
                  style={toggleBtn(voice === v.value, colors)}
                >
                  <div>{v.label}</div>
                  <div style={{ fontSize: 11, opacity: 0.8, marginTop: 2 }}>{v.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Route Avatar */}
          <div style={cardStyle(colors)}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <span style={{ fontSize: 20 }}>🤖</span>
              <h3 style={{ fontSize: 17, fontWeight: 600, color: colors.text, margin: 0 }}>Route Avatar</h3>
            </div>
            <p style={{ fontSize: 13, color: colors.textSecondary, marginBottom: 16, marginTop: 0 }}>
              Choose the worker figure for route playback animation
            </p>

            <div style={{ display: "flex", gap: 20, alignItems: "flex-start" }}>
              {/* Preview */}
              <div
                style={{
                  background: colors.bg,
                  borderRadius: 14,
                  padding: 20,
                  border: `1px solid ${colors.border}`,
                  textAlign: "center",
                  minWidth: 110,
                }}
              >
                <RouteAvatar gender={avatarGender} outfit={avatarOutfit} state={genderStates as any} size={80} />
                <div style={{ fontSize: 12, color: colors.textSecondary, marginTop: 10, fontWeight: 500 }}>Preview</div>
              </div>

              {/* Options */}
              <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 14 }}>
                {/* Presentation */}
                <div>
                  <label style={{ ...labelStyle(colors), display: "block", marginBottom: 8 }}>Presentation</label>
                  <div style={{ display: "flex", gap: 8 }}>
                    {presentations.map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => setAvatarGender(opt.value)}
                        style={toggleBtn(avatarGender === opt.value, colors)}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Outfit */}
                <div>
                  <label style={{ ...labelStyle(colors), display: "block", marginBottom: 8 }}>Outfit</label>
                  <div style={{ display: "flex", gap: 8 }}>
                    {outfits.map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => setAvatarOutfit(opt.value)}
                        style={toggleBtn(avatarOutfit === opt.value, colors)}
                      >
                        <span style={{ marginRight: 4 }}>{opt.icon}</span>
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

      {/* ─── Save Button ─── */}
      <button
        onClick={handleSave}
        style={{
          marginTop: 28,
          padding: "12px 32px",
          background: saved ? "#22c55e" : colors.accent,
          color: "#fff",
          borderRadius: 10,
          border: "none",
          cursor: "pointer",
          fontWeight: 600,
          fontSize: 15,
          transition: "all 0.2s ease",
          boxShadow: saved ? "0 2px 8px rgba(34,197,94,0.3)" : "0 2px 8px rgba(0,0,0,0.1)",
        }}
      >
        {saved ? "✓ Saved!" : "💾 Save Settings"}
      </button>
    </div>
  );
}
