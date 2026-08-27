import { useState, useEffect, useRef } from "react";

interface Props {
  text: string;
  speed?: number;
  onComplete?: () => void;
  style?: React.CSSProperties;
}

export default function TypingText({ text, speed = 18, onComplete, style }: Props) {
  const [displayed, setDisplayed] = useState("");
  const [done, setDone] = useState(false);
  const idx = useRef(0);

  useEffect(() => {
    idx.current = 0;
    setDisplayed("");
    setDone(false);

    const interval = setInterval(() => {
      idx.current++;
      if (idx.current >= text.length) {
        setDisplayed(text);
        setDone(true);
        clearInterval(interval);
        onComplete?.();
      } else {
        setDisplayed(text.slice(0, idx.current));
      }
    }, speed);

    return () => clearInterval(interval);
  }, [text, speed]);

  return (
    <span style={style}>
      {displayed}
      {!done && (
        <span
          style={{
            display: "inline-block",
            width: 2,
            height: "1em",
            background: "currentColor",
            marginLeft: 2,
            animation: "blink 0.7s step-end infinite",
            verticalAlign: "text-bottom",
          }}
        />
      )}
      <style>{`
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
      `}</style>
    </span>
  );
}
