import { useState, useEffect, useRef } from "react";

export type AvatarGender = "A" | "B" | "default";
export type AvatarOutfit = "construction" | "delivery" | "default";
export type AvatarState = "calm" | "attention" | "alert";

interface RouteAvatarProps {
  gender?: AvatarGender;
  outfit?: AvatarOutfit;
  state?: AvatarState;
  size?: number;
  animate?: boolean;
  onAnimationEnd?: () => void;
}

const OUTFIT_COLORS = {
  construction: { body: "#F59E0B", accent: "#92400E", helmet: "#FCD34D" },
  delivery: { body: "#3B82F6", accent: "#1E3A8A", helmet: "#60A5FA" },
  default: { body: "#6B7280", accent: "#374151", helmet: "#9CA3AF" },
};

const STATE_COLORS = {
  calm: "#22c55e",
  attention: "#f59e0b",
  alert: "#ef4444",
};

export function RouteAvatar({
  gender = "default",
  outfit = "default",
  state = "calm",
  size = 40,
  animate = false,
  onAnimationEnd,
}: RouteAvatarProps) {
  const colors = OUTFIT_COLORS[outfit];
  const stateColor = STATE_COLORS[state];
  const [bobOffset, setBobOffset] = useState(0);
  const animRef = useRef<number | null>(null);

  useEffect(() => {
    if (!animate) {
      setBobOffset(0);
      return;
    }
    const start = Date.now();
    const duration = 3000;
    const animateFrame = () => {
      const elapsed = Date.now() - start;
      const progress = Math.min(elapsed / duration, 1);
      const bob = Math.sin(progress * Math.PI * 6) * 3 * (1 - progress);
      setBobOffset(bob);
      if (progress < 1) {
        animRef.current = requestAnimationFrame(animateFrame);
      } else {
        setBobOffset(0);
        onAnimationEnd?.();
      }
    };
    animRef.current = requestAnimationFrame(animateFrame);
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current); };
  }, [animate, onAnimationEnd]);

  const isFeminine = gender === "B";

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      style={{ transform: `translateY(${bobOffset}px)`, transition: animate ? "none" : "transform 0.3s" }}
    >
      {/* Head */}
      <circle cx="20" cy="10" r="6" fill="#FBBF24" />

      {/* Helmet/hat based on outfit */}
      {outfit === "construction" && (
        <path d="M12 9 Q20 2 28 9 L26 11 Q20 5 14 11 Z" fill={colors.helmet} />
      )}
      {outfit === "delivery" && (
        <path d="M13 8 Q20 4 27 8 L25 10 Q20 6 15 10 Z" fill={colors.helmet} />
      )}

      {/* Body */}
      <rect x="14" y="16" width="12" height="14" rx="3" fill={colors.body} />

      {/* Hi-vis vest stripe for construction */}
      {outfit === "construction" && (
        <>
          <rect x="15" y="18" width="10" height="2" rx="1" fill="#FCD34D" />
          <rect x="15" y="22" width="10" height="2" rx="1" fill="#FCD34D" />
        </>
      )}

      {/* Arms */}
      <rect x="8" y="17" width="5" height="10" rx="2" fill={colors.accent} />
      <rect x="27" y="17" width="5" height="10" rx="2" fill={colors.accent} />

      {/* Legs */}
      <rect x="15" y="30" width="4" height="8" rx="2" fill={colors.accent} />
      <rect x="21" y="30" width="4" height="8" rx="2" fill={colors.accent} />

      {/* Boots */}
      <rect x="14" y="36" width="6" height="3" rx="1.5" fill="#374151" />
      <rect x="20" y="36" width="6" height="3" rx="1.5" fill="#374151" />

      {/* State indicator (eye glow) */}
      <circle cx="17" cy="9" r="1.5" fill={stateColor} />
      <circle cx="23" cy="9" r="1.5" fill={stateColor} />

      {/* Alert pulse */}
      {state === "alert" && (
        <circle
          cx="20"
          cy="20"
          r="18"
          fill="none"
          stroke={stateColor}
          strokeWidth="1.5"
          opacity="0.4"
        >
          <animate attributeName="r" from="14" to="20" dur="1s" repeatCount="indefinite" />
          <animate attributeName="opacity" from="0.5" to="0" dur="1s" repeatCount="indefinite" />
        </circle>
      )}
    </svg>
  );
}

interface RoutePlaybackProps {
  route: number[][];
  gender?: AvatarGender;
  outfit?: AvatarOutfit;
  state?: AvatarState;
  onComplete?: () => void;
  onHelpfulPrompt?: () => void;
}

export function RoutePlayback({
  route,
  gender,
  outfit,
  state,
  onComplete,
  onHelpfulPrompt,
}: RoutePlaybackProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [showHelpful, setShowHelpful] = useState(false);
  const [helpfulAnswer, setHelpfulAnswer] = useState<boolean | null>(null);
  const animRef = useRef<number | null>(null);
  const mapRef = useRef<any>(null);

  const startPlayback = () => {
    setIsPlaying(true);
    setProgress(0);
    setShowHelpful(false);
    const start = Date.now();
    const duration = 5000; // 5 seconds for the route animation

    const animate = () => {
      const elapsed = Date.now() - start;
      const p = Math.min(elapsed / duration, 1);
      setProgress(p);
      if (p < 1) {
        animRef.current = requestAnimationFrame(animate);
      } else {
        setIsPlaying(false);
        setShowHelpful(true);
        onHelpfulPrompt?.();
      }
    };
    animRef.current = requestAnimationFrame(animate);
  };

  const handleHelpful = (helpful: boolean) => {
    setHelpfulAnswer(helpful);
    setShowHelpful(false);
    // Write to audit log via backend
    fetch("/api/routes/helpful", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ helpful }),
    }).catch(() => {});
    onComplete?.();
  };

  // Interpolate position along route
  const getPosition = () => {
    if (!route.length) return { lat: 0, lon: 0 };
    const idx = Math.min(Math.floor(progress * (route.length - 1)), route.length - 2);
    const frac = (progress * (route.length - 1)) - idx;
    return {
      lat: route[idx][1] + (route[idx + 1][1] - route[idx][1]) * frac,
      lon: route[idx][0] + (route[idx + 1][0] - route[idx][0]) * frac,
    };
  };

  return (
    <div>
      {!isPlaying && !showHelpful && helpfulAnswer === null && (
        <button
          onClick={startPlayback}
          style={{
            padding: "8px 20px",
            background: "#c07a28",
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
          ▶ Start Route Playback
        </button>
      )}

      {isPlaying && (
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <RouteAvatar
            gender={gender}
            outfit={outfit}
            state={state}
            size={36}
            animate={true}
          />
          <div style={{ flex: 1 }}>
            <div style={{ height: 4, background: "#1e293b", borderRadius: 2, overflow: "hidden" }}>
              <div
                style={{
                  width: `${progress * 100}%`,
                  height: "100%",
                  background: "linear-gradient(90deg, #22c55e, #eab308, #ef4444)",
                  borderRadius: 2,
                  transition: "width 0.1s linear",
                }}
              />
            </div>
            <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 4 }}>
              {Math.round(progress * 100)}% — Worker en route...
            </div>
          </div>
        </div>
      )}

      {showHelpful && helpfulAnswer === null && (
        <div
          style={{
            background: "#1e293b",
            borderRadius: 12,
            padding: 16,
            border: "1px solid #334155",
            textAlign: "center",
          }}
        >
          <RouteAvatar gender={gender} outfit={outfit} state="calm" size={32} />
          <div style={{ fontSize: 14, fontWeight: 600, color: "#e2e8f0", marginTop: 8 }}>
            Route completed!
          </div>
          <div style={{ fontSize: 13, color: "#94a3b8", marginTop: 4 }}>
            Was this coolest route helpful?
          </div>
          <div style={{ display: "flex", gap: 8, justifyContent: "center", marginTop: 12 }}>
            <button
              onClick={() => handleHelpful(true)}
              style={{
                padding: "8px 20px",
                background: "#22c55e",
                color: "#fff",
                borderRadius: 8,
                border: "none",
                cursor: "pointer",
                fontWeight: 600,
              }}
            >
              👍 Yes
            </button>
            <button
              onClick={() => handleHelpful(false)}
              style={{
                padding: "8px 20px",
                background: "#ef4444",
                color: "#fff",
                borderRadius: 8,
                border: "none",
                cursor: "pointer",
                fontWeight: 600,
              }}
            >
              👎 No
            </button>
          </div>
        </div>
      )}

      {helpfulAnswer !== null && (
        <div
          style={{
            padding: "8px 14px",
            background: helpfulAnswer ? "#064e3b" : "#7f1d1d",
            borderRadius: 8,
            fontSize: 13,
            color: helpfulAnswer ? "#6ee7b7" : "#fca5a5",
            textAlign: "center",
          }}
        >
          {helpfulAnswer
            ? "Thanks! This data feeds into compliance reports."
            : "Got it — we'll note this for route optimization."}
        </div>
      )}
    </div>
  );
}
