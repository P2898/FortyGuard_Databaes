import { useState, useRef, useEffect } from "react";
import * as api from "../lib/api";

function KelvinAvatar({ level }: { level: string }) {
  const color = level === "CRITICAL" ? "#ef4444" : level === "HIGH" ? "#f97316" : "#22c55e";
  const eyes = level === "CRITICAL" ? "!" : level === "HIGH" ? "~" : "\u2022";
  return (
    <div style={{ width: 56, height: 56, borderRadius: "50%", background: color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, color: "white", flexShrink: 0, boxShadow: "0 0 20px " + color + "40" }}>
      <div style={{ display: "flex", gap: 4 }}><span>{eyes}</span><span>{eyes}</span></div>
    </div>
  );
}

export default function KelvinPanel() {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<{ role: string; text: string }[]>([
    { role: "kelvin", text: "Hi! I'm Kelvin. Ask me about site safety, riskiest sites, routes, or heat costs." },
  ]);
  const [speaking, setSpeaking] = useState(false);
  const [highestRisk, setHighestRisk] = useState("LOW");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const speak = (text: string) => {
    const voicePref = localStorage.getItem("shade_voice") || "default";
    const synth = window.speechSynthesis;
    const u = new SpeechSynthesisUtterance(text.replace(/<[^>]+>/g, ""));
    if (voicePref !== "default") {
      const voices = synth.getVoices();
      const v = voices.find((v) => v.name.includes(voicePref === "A" ? "Female" : "Male"));
      if (v) u.voice = v;
    }
    u.onstart = () => setSpeaking(true);
    u.onend = () => setSpeaking(false);
    synth.speak(u);
  };

  const send = async () => {
    if (!input.trim()) return;
    const q = input.trim();
    setInput("");
    setMessages((m) => [...m, { role: "user", text: q }]);
    try {
      const res = await api.askKelvin(q);
      setMessages((m) => [...m, { role: "kelvin", text: res.response }]);
      speak(res.response);
    } catch {
      setMessages((m) => [...m, { role: "kelvin", text: "Sorry, I couldn't process that." }]);
    }
  };

  return (
    <div>
      <h2 style={{ fontSize: 22, fontWeight: 700 }}>Kelvin {"\u2014"} Safety Assistant</h2>
      <p style={{ color: "#94a3b8", marginTop: 2 }}>Deterministic answers from backend data. No LLM makes up numbers.</p>
      <div style={{ display: "flex", gap: 16, marginTop: 20, alignItems: "flex-start" }}>
        <KelvinAvatar level={highestRisk} />
        <div style={{ flex: 1 }}>
          <div style={{ background: "#111827", borderRadius: 12, border: "1px solid #1e293b", padding: 16, maxHeight: 400, overflowY: "auto" }}>
            {messages.map((m, i) => (
              <div key={i} style={{ marginBottom: 12, display: "flex", flexDirection: "column", alignItems: m.role === "kelvin" ? "flex-start" : "flex-end" }}>
                <div style={{ padding: "8px 14px", borderRadius: 12, background: m.role === "kelvin" ? "#1e293b" : "#06b6d4", color: m.role === "kelvin" ? "#e2e8f0" : "#fff", maxWidth: "80%", fontSize: 14 }}>{m.text}</div>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} placeholder="Ask Kelvin..." style={{ flex: 1, padding: "10px 14px", border: "1px solid #334155", borderRadius: 8, fontSize: 14, background: "#0f172a", color: "#e2e8f0" }} />
            <button onClick={send} style={{ padding: "10px 16px", background: "#06b6d4", color: "#fff", borderRadius: 8, border: "none", cursor: "pointer", fontWeight: 600 }}>
              {speaking ? "\uD83D\uDD0A" : "Send"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
