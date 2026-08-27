import { useState, useEffect, useRef, useCallback } from "react";

interface Props {
  onComplete: () => void;
}

// Pixel grid for the "S" shape — each row is an array of 1 = filled, 0 = empty
const S_PIXELS = [
  [0, 1, 1, 1, 1, 1, 0],
  [1, 0, 0, 0, 0, 0, 1],
  [1, 0, 0, 0, 0, 0, 1],
  [0, 1, 1, 1, 1, 0, 0],
  [0, 0, 0, 0, 0, 1, 1],
  [1, 0, 0, 0, 0, 0, 1],
  [0, 1, 1, 1, 1, 1, 0],
];

const ARROW_LEFT = [
  [0, 0, 0, 1],
  [0, 0, 1, 0],
  [1, 1, 1, 1],
  [0, 0, 1, 0],
  [0, 0, 0, 1],
];

const ARROW_RIGHT = [
  [0, 1, 0, 0],
  [0, 0, 1, 0],
  [1, 1, 1, 1],
  [0, 0, 1, 0],
  [0, 1, 0, 0],
];

type PixelState = "hidden" | "appearing" | "visible" | "pixelating" | "gone";

interface Pixel {
  row: number;
  col: number;
  state: PixelState;
  delay: number;
  dissolving: boolean;
  scatterX: number;
  scatterY: number;
}

export default function SplashScreen({ onComplete }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const startTimeRef = useRef<number>(0);
  const phaseRef = useRef<"draw" | "hold" | "dissolve">("draw");
  const pixelsRef = useRef<Pixel[]>([]);
  const [phase, setPhase] = useState<"draw" | "hold" | "dissolve">("draw");

  const GRID_SIZE = 7;
  const PX = 18; // pixel size
  const GAP = 3;
  const CELL = PX + GAP;

  // Arrow dimensions
  const ARROW_GRID_W = 4;
  const ARROW_GRID_H = 5;
  const ARROW_PX = 12;
  const ARROW_GAP = 2;
  const ARROW_CELL = ARROW_PX + ARROW_GAP;

  // Total S grid dimensions
  const TOTAL_W = GRID_SIZE * CELL;
  const TOTAL_H = GRID_SIZE * CELL;

  // Arrow offsets
  const LEFT_ARROW_X = -(ARROW_GRID_W * ARROW_CELL + 16);
  const LEFT_ARROW_Y = (TOTAL_H - ARROW_GRID_H * ARROW_CELL) / 2;
  const RIGHT_ARROW_X = TOTAL_W + 16;
  const RIGHT_ARROW_Y = (TOTAL_H - ARROW_GRID_H * ARROW_CELL) / 2;

  const initPixels = useCallback(() => {
    const pixels: Pixel[] = [];

    // S pixels
    for (let r = 0; r < GRID_SIZE; r++) {
      for (let c = 0; c < GRID_SIZE; c++) {
        if (S_PIXELS[r][c]) {
          const dist = Math.sqrt(
            Math.pow(r - GRID_SIZE / 2, 2) + Math.pow(c - GRID_SIZE / 2, 2)
          );
          pixels.push({
            row: r,
            col: c,
            state: "hidden",
            delay: dist * 60,
            dissolving: false,
            scatterX: (Math.random() - 0.5) * 400,
            scatterY: (Math.random() - 0.5) * 400,
          });
        }
      }
    }

    // Left arrow pixels
    for (let r = 0; r < ARROW_GRID_H; r++) {
      for (let c = 0; c < ARROW_GRID_W; c++) {
        if (ARROW_LEFT[r][c]) {
          const dist = Math.abs(r - 2) + Math.abs(c - 2);
          pixels.push({
            row: r,
            col: c + LEFT_ARROW_X / ARROW_CELL,
            state: "hidden",
            delay: 600 + dist * 40,
            dissolving: false,
            scatterX: -(Math.random() * 300 + 100),
            scatterY: (Math.random() - 0.5) * 400,
            // Store arrow metadata in unused fields
          } as Pixel & { _isArrow?: string });
          // Use a hack: store arrow info in the pixel
        }
      }
    }

    // Right arrow pixels
    for (let r = 0; r < ARROW_GRID_H; r++) {
      for (let c = 0; c < ARROW_GRID_W; c++) {
        if (ARROW_RIGHT[r][c]) {
          const dist = Math.abs(r - 2) + Math.abs(c - 2);
          pixels.push({
            row: r,
            col: c + RIGHT_ARROW_X / ARROW_CELL,
            state: "hidden",
            delay: 600 + dist * 40,
            dissolving: false,
            scatterX: Math.random() * 300 + 100,
            scatterY: (Math.random() - 0.5) * 400,
          } as Pixel & { _isArrow?: string });
        }
      }
    }

    return pixels;
  }, []);

  const draw = useCallback(
    (ctx: CanvasRenderingContext2D, w: number, h: number, progress: number) => {
      const cx = w / 2;
      const cy = h / 2;

      // Background
      ctx.fillStyle = "#0c0e1a";
      ctx.fillRect(0, 0, w, h);

      // Subtle radial glow
      const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, 200);
      glow.addColorStop(0, "rgba(6, 182, 212, 0.08)");
      glow.addColorStop(1, "rgba(6, 182, 212, 0)");
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, w, h);

      const offsetX = cx - TOTAL_W / 2;
      const offsetY = cy - TOTAL_H / 2;

      // Draw S pixels
      let sIdx = 0;
      for (let r = 0; r < GRID_SIZE; r++) {
        for (let c = 0; c < GRID_SIZE; c++) {
          if (S_PIXELS[r][c]) {
            const p = pixelsRef.current[sIdx];
            if (p && p.state !== "hidden" && p.state !== "gone") {
              let alpha = 1;
              let x = offsetX + c * CELL;
              let y = offsetY + r * CELL;
              let size = PX;

              if (p.state === "appearing") {
                const appear = Math.min(1, (progress * 1000 - p.delay) / 200);
                alpha = appear;
                size = PX * appear;
                x = offsetX + c * CELL + (PX - size) / 2;
                y = offsetY + r * CELL + (PX - size) / 2;
              } else if (p.state === "pixelating") {
                const dissolveProgress = Math.min(1, (progress * 1000 - p.delay - 800) / 600);
                alpha = 1 - dissolveProgress;
                size = PX * (1 - dissolveProgress * 0.5);
                x = offsetX + c * CELL + p.scatterX * dissolveProgress + (PX - size) / 2;
                y = offsetY + r * CELL + p.scatterY * dissolveProgress + (PX - size) / 2;

                // Add slight rotation for scatter effect
                ctx.save();
                ctx.translate(x + size / 2, y + size / 2);
                ctx.rotate(dissolveProgress * Math.PI * 0.5);
                ctx.fillStyle = `rgba(6, 182, 212, ${alpha})`;
                ctx.shadowColor = `rgba(6, 182, 212, ${alpha * 0.6})`;
                ctx.shadowBlur = 8;
                ctx.fillRect(-size / 2, -size / 2, size, size);
                ctx.restore();
                sIdx++;
                continue;
              }

              ctx.fillStyle = `rgba(6, 182, 212, ${alpha})`;
              ctx.shadowColor = `rgba(6, 182, 212, ${alpha * 0.6})`;
              ctx.shadowBlur = 6;
              ctx.fillRect(x, y, size, size);
              ctx.shadowBlur = 0;
            }
            sIdx++;
          }
        }
      }

      // Draw arrow pixels
      const arrowPixels = pixelsRef.current.slice(GRID_SIZE * GRID_SIZE - S_PIXELS.flat().filter(Boolean).length + S_PIXELS.flat().filter(Boolean).length);

      // Simpler approach: draw arrows from state
      let arrowIdx = GRID_SIZE * GRID_SIZE - S_PIXELS.flat().filter(Boolean).length + S_PIXELS.flat().filter(Boolean).length;
      // Actually let's just redraw all remaining pixels
    },
    []
  );

  // Simpler canvas-based approach
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dpr = window.devicePixelRatio || 1;
    const w = window.innerWidth;
    const h = window.innerHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;

    const ctx = canvas.getContext("2d")!;
    ctx.scale(dpr, dpr);

    startTimeRef.current = performance.now();

    // Build all pixels
    const allPixels: {
      x: number;
      y: number;
      size: number;
      color: string;
      delay: number;
      scatterX: number;
      scatterY: number;
      type: "s" | "leftArrow" | "rightArrow";
      gridR: number;
      gridC: number;
    }[] = [];

    const cx = w / 2;
    const cy = h / 2;
    const offX = cx - TOTAL_W / 2;
    const offY = cy - TOTAL_H / 2;

    // S pixels
    for (let r = 0; r < GRID_SIZE; r++) {
      for (let c = 0; c < GRID_SIZE; c++) {
        if (S_PIXELS[r][c]) {
          const dist = Math.sqrt(
            Math.pow(r - GRID_SIZE / 2, 2) + Math.pow(c - GRID_SIZE / 2, 2)
          );
          allPixels.push({
            x: offX + c * CELL,
            y: offY + r * CELL,
            size: PX,
            color: "#c07a28",
            delay: dist * 70,
            scatterX: (Math.random() - 0.5) * 500,
            scatterY: (Math.random() - 0.5) * 500,
            type: "s",
            gridR: r,
            gridC: c,
          });
        }
      }
    }

    // Left arrow
    for (let r = 0; r < ARROW_GRID_H; r++) {
      for (let c = 0; c < ARROW_GRID_W; c++) {
        if (ARROW_LEFT[r][c]) {
          const dist = Math.abs(r - 2) + Math.abs(c - 2);
          allPixels.push({
            x: cx - TOTAL_W / 2 - 14 + c * ARROW_CELL - (ARROW_GRID_W * ARROW_CELL) / 2,
            y: cy - (ARROW_GRID_H * ARROW_CELL) / 2 + r * ARROW_CELL,
            size: ARROW_PX,
            color: "#94a3b8",
            delay: 700 + dist * 50,
            scatterX: -(Math.random() * 300 + 200),
            scatterY: (Math.random() - 0.5) * 500,
            type: "leftArrow",
            gridR: r,
            gridC: c,
          });
        }
      }
    }

    // Right arrow
    for (let r = 0; r < ARROW_GRID_H; r++) {
      for (let c = 0; c < ARROW_GRID_W; c++) {
        if (ARROW_RIGHT[r][c]) {
          const dist = Math.abs(r - 2) + Math.abs(c - 2);
          allPixels.push({
            x: cx + TOTAL_W / 2 + 14 + c * ARROW_CELL - (ARROW_GRID_W * ARROW_CELL) / 2,
            y: cy - (ARROW_GRID_H * ARROW_CELL) / 2 + r * ARROW_CELL,
            size: ARROW_PX,
            color: "#94a3b8",
            delay: 700 + dist * 50,
            scatterX: Math.random() * 300 + 200,
            scatterY: (Math.random() - 0.5) * 500,
            type: "rightArrow",
            gridR: r,
            gridC: c,
          });
        }
      }
    }

    const HOLD_DURATION = 1200; // ms to hold after all drawn
    const DISSOLVE_DURATION = 800;

    // Find max delay
    const maxDelay = Math.max(...allPixels.map((p) => p.delay)) + 300; // +300 for appear animation

    let frameId: number;

    const animate = (now: number) => {
      const elapsed = now - startTimeRef.current;

      // Clear
      ctx.fillStyle = "#0c0e1a";
      ctx.fillRect(0, 0, w, h);

      // Subtle radial glow
      const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, 250);        glow.addColorStop(0, "rgba(192, 122, 40, 0.06)");
      glow.addColorStop(1, "rgba(192, 122, 40, 0)");
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, w, h);

      const dissolveStart = maxDelay + HOLD_DURATION;
      const isDissolving = elapsed > dissolveStart;

      // Subtitle text
      if (elapsed > maxDelay * 0.6 && !isDissolving) {
        const textAlpha = Math.min(1, (elapsed - maxDelay * 0.6) / 300);
        ctx.fillStyle = `rgba(148, 163, 184, ${textAlpha})`;
        ctx.font = "500 13px 'Inter', system-ui, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("FortyGuard-powered worker safety", cx, cy + TOTAL_H / 2 + 40);
      }

      // Draw all pixels
      for (const p of allPixels) {
        const appearTime = elapsed - p.delay;
        let alpha = 0;
        let drawX = p.x;
        let drawY = p.y;
        let drawSize = p.size;

        if (!isDissolving) {
          // Appear phase
          if (appearTime > 0) {
            const t = Math.min(1, appearTime / 250);
            // Ease out cubic
            const ease = 1 - Math.pow(1 - t, 3);
            alpha = ease;
            drawSize = p.size * ease;
            drawX = p.x + (p.size - drawSize) / 2;
            drawY = p.y + (p.size - drawSize) / 2;
          }
        } else {
          // Dissolve phase
          const dissolveTime = elapsed - dissolveStart - p.delay * 0.15;
          if (dissolveTime > 0) {
            const t = Math.min(1, dissolveTime / DISSOLVE_DURATION);
            const ease = t * t; // ease in
            alpha = 1 - ease;

            // Scatter pixels outward
            drawX = p.x + p.scatterX * ease;
            drawY = p.y + p.scatterY * ease;
            drawSize = p.size * (1 - ease * 0.6);

            // Add rotation
            ctx.save();
            ctx.translate(drawX + drawSize / 2, drawY + drawSize / 2);
            ctx.rotate(ease * Math.PI * 0.8);
            ctx.fillStyle = hexToRgba(p.color, alpha * 0.9);
            ctx.shadowColor = hexToRgba(p.color, alpha * 0.5);
            ctx.shadowBlur = 10 * (1 - ease);
            ctx.fillRect(-drawSize / 2, -drawSize / 2, drawSize, drawSize);
            ctx.restore();
            continue;
          }
        }

        if (alpha > 0) {
          ctx.fillStyle = hexToRgba(p.color, alpha * 0.9);
          ctx.shadowColor = hexToRgba(p.color, alpha * 0.5);
          ctx.shadowBlur = 8;
          ctx.fillRect(drawX, drawY, drawSize, drawSize);
          ctx.shadowBlur = 0;
        }
      }

      // Fade subtitle out during dissolve
      if (isDissolving) {
        const fadeText = Math.max(
          0,
          1 - (elapsed - dissolveStart) / (DISSOLVE_DURATION * 0.5)
        );
        if (fadeText > 0) {
          ctx.fillStyle = `rgba(148, 163, 184, ${fadeText})`;
          ctx.font = "500 13px 'Inter', system-ui, sans-serif";
          ctx.textAlign = "center";
          ctx.fillText(
            "FortyGuard-powered worker safety",
            cx,
            cy + TOTAL_H / 2 + 40
          );
        }
      }

      // Check if fully dissolved
      if (isDissolving && elapsed > dissolveStart + DISSOLVE_DURATION + maxDelay * 0.15 + 400) {
        onComplete();
        return;
      }

      frameId = requestAnimationFrame(animate);
    };

    frameId = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(frameId);
    };
  }, [onComplete]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100vw",
        height: "100vh",
        zIndex: 99999,
        cursor: "pointer",
      }}
      onClick={onComplete}
      title="Click to skip"
    />
  );
}

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
