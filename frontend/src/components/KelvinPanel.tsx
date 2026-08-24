import { useState, useRef, useEffect } from "react";
import * as api from "../lib/api";

function KelvinAvatar({ level, speaking }: { level: string; speaking: boolean }) {
  const bgColor =
    level === "CRITICAL"
      ? "linear-gradient(135deg, #dc2626, #991b1b)"
      : level === "HIGH"
        ? "linear-gradient(135deg, #ea580c, #c2410c)"
        : level === "MEDIUM"
          ? "linear-gradient(135deg, #d97706, #b45309)"
          : "linear-gradient(135deg, #06b6d4, #0891b2)";

  const eyeChar = level === "CRITICAL" ? "!" : level === "HIGH" ? "~" : "\u2022";
  const glowColor =
    level === "CRITICAL" ? "#ef4444" : level === "HIGH" ? "#f97316" : "#06b6d4";

  return (
    <div style={{ position: "relative", flexShrink: 0 }}>
      <div
        style={{
          width: 64,
          height: 64,
          borderRadius: "50%",
          background: bgColor,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 24,
          color: "white",
          boxShadow: `0 0 ${speaking ? 30 : 15}px ${glowColor}60`,
          transition: "box-shadow 0.3s ease",
          animation: speaking ? "pulse 1s infinite" : "none",
        }}
      >
        <div style={{ display: "flex", gap: 6, fontWeight: 700 }}>
          <span style={{ animation: speaking ? "blink 0.5s infinite" : "none" }}>{eyeChar}</span>
          <span style={{ animation: speaking ? "blink 0.5s infinite 0.1s" : "none" }}>{eyeChar}</span>
        </div>
      </div>
      <div
        style={{
          position: "absolute",
          bottom: -2,
          right: -2,
          width: 16,
          height: 16,
          borderRadius: "50%",
          background: level === "CRITICAL" ? "#ef4444" : level === "HIGH" ? "#f97316" : "#22c55e",
          border: "2px solid #111827",
        }}
      />
      <style>{`
        @keyframes pulse { 0%,100% { transform: scale(1); } 50% { transform: scale(1.05); } }
        @keyframes blink { 0%,100% { opacity: 1; } 50% { opacity: 0.3; } }
      `}</style>
    </div>
  );
}

export default function KelvinPanel({ onNavigateRoute }: { onNavigateRoute?: (originId: string, destId: string) => void } = {}) {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<{ role: string; text: string; action?: any }[]>([
    {
      role: "kelvin",
      text: "Hi! I'm Kelvin, your heat safety assistant. Ask me about site safety, riskiest sites, routes, or heat costs.",
    },
  ]);
  const [speaking, setSpeaking] = useState(false);
  const [listening, setListening] = useState(false);
  const [highestRisk, setHighestRisk] = useState("LOW");
  const [voiceOption, setVoiceOption] = useState(() => localStorage.getItem("shade_voice") || "default");
  const bottomRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Check browser Speech API support
  const speechSupported = typeof window !== "undefined" && ("SpeechRecognition" in window || "webkitSpeechRecognition" in window);

  const speak = (text: string) => {
    const synth = window.speechSynthesis;
    if (!synth) return;

    // Cancel any ongoing speech
    synth.cancel();

    const u = new SpeechSynthesisUtterance(text.replace(/<[^>]+>/g, ""));

    // Voice selection
    if (voiceOption !== "default") {
      const voices = synth.getVoices();
      if (voiceOption === "A") {
        // Prefer female voice
        const v = voices.find((v) => /female|zira|samantha|karen|moira/i.test(v.name));
        if (v) u.voice = v;
      } else {
        // Prefer male voice
        const v = voices.find((v) => /male|david|daniel| james/i.test(v.name));
        if (v) u.voice = v;
      }
    }

    u.rate = 1.0;
    u.pitch = 1.0;
    u.onstart = () => setSpeaking(true);
    u.onend = () => setSpeaking(false);
    u.onerror = () => setSpeaking(false);
    synth.speak(u);
  };

  const startListening = () => {
    if (!speechSupported) return;

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = "en-US";

    recognition.onstart = () => setListening(true);
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setInput(transcript);
      setListening(false);
      // Auto-send after short delay
      setTimeout(() => {
        sendWithText(transcript);
      }, 300);
    };
    recognition.onerror = () => setListening(false);
    recognition.onend = () => setListening(false);

    recognitionRef.current = recognition;
    recognition.start();
  };

  const stopListening = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      setListening(false);
    }
  };

  const sendWithText = async (text: string) => {
    if (!text.trim()) return;
    const q = text.trim();
    setMessages((m) => [...m, { role: "user", text: q }]);
    try {
      const res = await api.askKelvin(q);
      setMessages((m) => [...m, { role: "kelvin", text: res.response, action: res.data?.action || null }]);

      // Update avatar risk level from response data
      if (res.data?.risk_bucket) {
        setHighestRisk(res.data.risk_bucket);
      }

      speak(res.response);
    } catch {
      setMessages((m) => [
        ...m,
        { role: "kelvin", text: "Sorry, I couldn't process that. Please try again." },
      ]);
    }
  };

  const send = () => {
    const text = input;
    setInput("");
    sendWithText(text);
  };

  const quickQuestions = [
    "Which site is riskiest?",
    "What did heat cost us today?",
    "How many sites are critical?",
  ];

  return (
    <div>
      <h2 style={{ fontSize: 22, fontWeight: 700 }}>Kelvin {"\u2014"} Safety Assistant</h2>
      <p style={{ color: "#94a3b8", marginTop: 2 }}>
        Deterministic answers from backend data. No LLM makes up numbers.
      </p>

      <div style={{ display: "flex", gap: 16, marginTop: 20, alignItems: "flex-start" }}>
        <KelvinAvatar level={highestRisk} speaking={speaking} />

        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Chat messages */}
          <div
            style={{
              background: "#111827",
              borderRadius: 12,
              border: "1px solid #1e293b",
              padding: 16,
              maxHeight: 400,
              overflowY: "auto",
              minHeight: 200,
            }}
          >
            {messages.map((m, i) => (
              <div
                key={i}
                style={{
                  marginBottom: 12,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: m.role === "kelvin" ? "flex-start" : "flex-end",
                }}
              >
                {m.role === "kelvin" && (
                  <div style={{ fontSize: 10, color: "#64748b", marginBottom: 2, marginLeft: 4 }}>
                    Kelvin
                  </div>
                )}
                <div
                  style={{
                    padding: "10px 16px",
                    borderRadius: m.role === "kelvin" ? "4px 12px 12px 12px" : "12px 4px 12px 12px",
                    background: m.role === "kelvin" ? "#1e293b" : "#06b6d4",
                    color: m.role === "kelvin" ? "#e2e8f0" : "#fff",
                    maxWidth: "85%",
                    fontSize: 14,
                    lineHeight: 1.5,
                    whiteSpace: "pre-wrap",
                  }}
                >
                  {m.text}
                  {m.action?.type === "navigate_route" && onNavigateRoute && (
                    <div style={{ marginTop: 10 }}>
                      <button
                        onClick={() => onNavigateRoute(m.action.origin_id, m.action.dest_id)}
                        style={{
                          padding: "8px 16px",
                          background: "linear-gradient(135deg, #06b6d4, #0891b2)",
                          color: "#fff",
                          borderRadius: 8,
                          border: "none",
                          cursor: "pointer",
                          fontWeight: 600,
                          fontSize: 13,
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                          width: "100%",
                          justifyContent: "center",
                        }}
                      >
                        🗺️ Open Route Planner
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>

          {/* Quick question chips */}
          <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
            {quickQuestions.map((q) => (
              <button
                key={q}
                onClick={() => {
                  setInput("");
                  sendWithText(q);
                }}
                style={{
                  padding: "5px 12px",
                  background: "#1e293b",
                  color: "#94a3b8",
                  borderRadius: 16,
                  border: "1px solid #334155",
                  cursor: "pointer",
                  fontSize: 12,
                  transition: "all 0.15s",
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.borderColor = "#06b6d4";
                  e.currentTarget.style.color = "#e2e8f0";
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.borderColor = "#334155";
                  e.currentTarget.style.color = "#94a3b8";
                }}
              >
                {q}
              </button>
            ))}
          </div>

          {/* Input bar */}
          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            {speechSupported && (
              <button
                onClick={listening ? stopListening : startListening}
                style={{
                  padding: "10px 14px",
                  background: listening ? "#ef4444" : "#1e293b",
                  color: listening ? "#fff" : "#94a3b8",
                  borderRadius: 8,
                  border: "1px solid #334155",
                  cursor: "pointer",
                  fontSize: 16,
                  transition: "all 0.15s",
                  flexShrink: 0,
                }}
                title={listening ? "Stop listening" : "Speak to Kelvin"}
              >
                {listening ? "\u23F9" : "\uD83C\uDF99"}
              </button>
            )}
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && send()}
              placeholder="Ask Kelvin about site safety, routes, heat costs..."
              style={{
                flex: 1,
                padding: "10px 14px",
                border: "1px solid #334155",
                borderRadius: 8,
                fontSize: 14,
                background: "#0f172a",
                color: "#e2e8f0",
              }}
            />
            <button
              onClick={send}
              disabled={!input.trim()}
              style={{
                padding: "10px 20px",
                background: input.trim() ? "#06b6d4" : "#334155",
                color: "#fff",
                borderRadius: 8,
                border: "none",
                cursor: "pointer",
                fontWeight: 600,
                fontSize: 14,
                transition: "background 0.15s",
              }}
            >
              {speaking ? "\uD83D\uDD0A" : "Send"}
            </button>
          </div>

          {/* Voice indicator */}
          {listening && (
            <div style={{ marginTop: 8, fontSize: 12, color: "#ef4444", display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#ef4444", animation: "pulse 1s infinite" }} />
              Listening... Speak now
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
