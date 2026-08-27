import { useState, useEffect, useRef } from "react";
import { useTheme } from "../lib/theme";

export interface RiskChange {
  siteName: string;
  oldRisk: string;
  newRisk: string;
  temperature: number;
}

interface Props {
  changes: RiskChange[];
  onDismiss: (idx: number) => void;
}

const RISK_COLORS: Record<string, string> = {
  CRITICAL: "#ef4444",
  HIGH: "#f97316",
  MEDIUM: "#eab308",
  LOW: "#22c55e",
};

export default function RiskToast({ changes, onDismiss }: Props) {
  const { colors } = useTheme();

  useEffect(() => {
    if (changes.length === 0) return;
    const timer = setTimeout(() => {
      onDismiss(0);
    }, 5000);
    return () => clearTimeout(timer);
  }, [changes, onDismiss]);

  if (changes.length === 0) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: 16,
        right: 16,
        zIndex: 10000,
        display: "flex",
        flexDirection: "column",
        gap: 8,
        maxWidth: 360,
      }}
    >
      {changes.map((change, idx) => (
        <div
          key={`${change.siteName}-${change.newRisk}-${idx}`}
          style={{
            background: colors.surface,
            border: `1px solid ${RISK_COLORS[change.newRisk] || colors.border}`,
            borderLeft: `4px solid ${RISK_COLORS[change.newRisk] || colors.border}`,
            borderRadius: 10,
            padding: "12px 16px",
            boxShadow: "0 8px 24px rgba(0,0,0,0.2)",
            animation: "slideInRight 0.3s ease-out",
            cursor: "pointer",
          }}
          onClick={() => onDismiss(idx)}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: RISK_COLORS[change.newRisk],
                animation: "pulse 1.5s ease-in-out infinite",
              }}
            />
            <span style={{ fontSize: 13, fontWeight: 600, color: colors.text }}>
              {change.siteName}
            </span>
          </div>
          <div style={{ fontSize: 12, color: colors.textSecondary }}>
            Risk escalated{" "}
            <span style={{ color: RISK_COLORS[change.oldRisk], fontWeight: 500 }}>
              {change.oldRisk}
            </span>{" "}
            →{" "}
            <span style={{ color: RISK_COLORS[change.newRisk], fontWeight: 600 }}>
              {change.newRisk}
            </span>
          </div>
          <div style={{ fontSize: 11, color: colors.textMuted, marginTop: 4 }}>
            🌡️ {change.temperature.toFixed(1)}°C / {((change.temperature * 9) / 5 + 32).toFixed(0)}°F
          </div>
        </div>
      ))}
      <style>{`
        @keyframes slideInRight {
          from { opacity: 0; transform: translateX(100px); }
          to { opacity: 1; transform: translateX(0); }
        }
      `}</style>
    </div>
  );
}
