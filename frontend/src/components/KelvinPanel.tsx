import { useState, useRef, useEffect, useCallback } from "react";
import { sendChat, transcribeAudio, type ChatMessage } from "../lib/api";
import { useTheme } from "../lib/theme";
import TypingText from "./TypingText";

// ─── Text-to-Speech helper ───────────────────────────────────────────
function stripMarkdown(text: string): string {
  return text
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/#{1,3}\s/g, "")
    .replace(/\n{2,}/g, ". ")
    .replace(/\n/g, " ")
    .replace(/•/g, "")
    .replace(/📌|🎯|⏱️|🤖|📚/g, "");
}

function speakText(text: string, voicePref: string): Promise<void> {
  return new Promise((resolve) => {
    if (!window.speechSynthesis) {
      resolve();
      return;
    }
    // Cancel any ongoing speech
    window.speechSynthesis.cancel();

    const utter = new SpeechSynthesisUtterance(stripMarkdown(text));
    utter.rate = 1.0;
    utter.pitch = 1.0;
    utter.volume = 1.0;

    // Try to pick a voice matching the preference
    const voices = window.speechSynthesis.getVoices();
    if (voices.length > 0) {
      if (voicePref === "A") {
        // Female voice — prefer English female
        const female = voices.find(
          (v) => /female|samantha|zira|karen|moira|tessa|google.*female|susan|hearing/i.test(v.name) && v.lang.startsWith("en")
        ) || voices.find((v) => v.lang.startsWith("en") && /\bf\b/i.test(v.name));
        if (female) utter.voice = female;
      } else if (voicePref === "B") {
        // Male voice — prefer English male
        const male = voices.find(
          (v) => /male|daniel|james|david|mark|google.*male|matthew|alex/i.test(v.name) && v.lang.startsWith("en")
        ) || voices.find((v) => v.lang.startsWith("en") && /\bm\b/i.test(v.name));
        if (male) utter.voice = male;
      }
      // default → let browser choose
    }

    utter.onend = () => resolve();
    utter.onerror = () => resolve();
    window.speechSynthesis.speak(utter);
  });
}

function stopSpeech() {
  if (window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }
}

interface Props {
  onNavigateRoute?: (originId: string, destId: string) => void;
}

interface Message {
  role: "user" | "kelvin";
  text: string;
  timestamp: string;
  intent?: string;
  confidence?: number;
  sources?: { id: string; title: string; score: number }[];
  suggestions?: string[];
  agents_invoked?: string[];
  response_time_ms?: number;
}

const QUICK_PROMPTS = [
  "Which site is riskiest right now?",
  "What did heat cost us today?",
  "Is it safe to work outdoors?",
  "What are OSHA heat thresholds?",
  "Plan a route from Oakland to Tracy",
  "What compliance requirements do we have?",
];

export default function KelvinPanel({ onNavigateRoute }: Props) {
  const { colors } = useTheme();
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "kelvin",
      text: "👋 Hi! I'm **Kelvin**, your AI heat safety assistant. I can answer questions about:\n\n• 🔍 **Heat risk** — site safety and risk levels\n• 💰 **Costs** — financial impact of heat\n• 🗺️ **Routes** — heat-optimal path planning\n• 📋 **Compliance** — OSHA/Cal-OSHA regulations\n• 🏥 **Health** — heat-related health effects\n\nTry the quick prompts below, type your question, or click the 🎤 to record your voice!",
      timestamp: new Date().toLocaleTimeString(),
      intent: "greeting",
      confidence: 1.0,
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [useAgents, setUseAgents] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [transcribing, setTranscribing] = useState(false);
  const [voicePref] = useState(() => localStorage.getItem("shade_voice") || "default");
  const [autoSpeak, setAutoSpeak] = useState(() => localStorage.getItem("shade_auto_speak") !== "false");
  const [speakingIdx, setSpeakingIdx] = useState<number | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isRecording, transcribing]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        mediaRecorderRef.current.stop();
      }
      stopSpeech();
    };
  }, []);

  // Load browser voices (they load async on some browsers)
  useEffect(() => {
    if (window.speechSynthesis) {
      window.speechSynthesis.getVoices();
      window.speechSynthesis.onvoiceschanged = () => window.speechSynthesis.getVoices();
    }
  }, []);

  const toggleAutoSpeak = () => {
    const next = !autoSpeak;
    setAutoSpeak(next);
    localStorage.setItem("shade_auto_speak", String(next));
    if (!next) stopSpeech();
  };

  const handleSpeak = useCallback(
    async (text: string, idx: number) => {
      if (speakingIdx === idx) {
        stopSpeech();
        setSpeakingIdx(null);
        return;
      }
      stopSpeech();
      setSpeakingIdx(idx);
      await speakText(text, voicePref);
      setSpeakingIdx(null);
    },
    [speakingIdx, voicePref]
  );

  const handleSend = async (text?: string) => {
    const msg = text || input.trim();
    if (!msg || loading) return;

    const userMsg: Message = {
      role: "user",
      text: msg,
      timestamp: new Date().toLocaleTimeString(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const response = await sendChat(msg, useAgents);

      const kelvinMsg: Message = {
        role: "kelvin",
        text: response.answer,
        timestamp: new Date().toLocaleTimeString(),
        intent: response.intent,
        confidence: response.confidence,
        sources: response.sources,
        suggestions: response.suggestions,
        agents_invoked: response.agents_invoked || undefined,
        response_time_ms: response.response_time_ms,
      };

      setMessages((prev) => [...prev, kelvinMsg]);

      // Auto-navigate to Routes page if chatbot triggered navigation
      if (response.navigate_to === "routes" && response.route_params) {
        const { origin, destination } = response.route_params;
        // Dispatch custom event so App.tsx can handle navigation
        window.dispatchEvent(new CustomEvent("navigate-route", {
          detail: { origin, destination, mode: "drive" }
        }));
      }

      // Auto-speak the response if enabled
      if (autoSpeak && window.speechSynthesis) {
        const idx = messages.length + 1; // +1 for user msg we just added
        handleSpeak(response.answer, idx);
      }
    } catch (e) {
      setMessages((prev) => [
        ...prev,
        {
          role: "kelvin",
          text: "⚠️ Sorry, I encountered an error processing your request. Please try again.",
          timestamp: new Date().toLocaleTimeString(),
          intent: "error",
          confidence: 0,
        },
      ]);
    }
    setLoading(false);
  };

  const toggleRecording = async () => {
    // STOP recording
    if (isRecording && mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      return;
    }

    // START recording
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 16000,
        },
      });

      // Pick the best supported format
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : "audio/mp4";

      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        // Stop timer
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }

        // Stop all tracks to release mic
        stream.getTracks().forEach((track) => track.stop());

        setIsRecording(false);

        // Create audio blob
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });

        if (audioBlob.size < 500) {
          // Too short, likely no audio captured
          setMessages((prev) => [
            ...prev,
            {
              role: "kelvin",
              text: "🔇 Recording was too short. Click 🎤 and speak for at least 1-2 seconds.",
              timestamp: new Date().toLocaleTimeString(),
              intent: "info",
              confidence: 1.0,
            },
          ]);
          return;
        }

        // Send to backend for transcription
        console.log(`[voice] Sending ${audioBlob.size} bytes to transcribe...`);
        setTranscribing(true);
        try {
          const result = await transcribeAudio(audioBlob);

          if (result.text && result.text.trim()) {
            // Got transcription — send it
            setInput(result.text.trim());
            setTimeout(() => handleSend(result.text.trim()), 100);
          } else if (result.message) {
            // Backend returned a message (e.g., whisper not installed)
            setMessages((prev) => [
              ...prev,
              {
                role: "kelvin",
                text: `🎤 **Voice recording captured** (${(audioBlob.size / 1024).toFixed(0)}KB)\n\n${result.message}`,
                timestamp: new Date().toLocaleTimeString(),
                intent: "info",
                confidence: 1.0,
              },
            ]);
          } else {
            setMessages((prev) => [
              ...prev,
              {
                role: "kelvin",
                text: "🔇 Could not understand the audio. Please try speaking more clearly or type your message.",
                timestamp: new Date().toLocaleTimeString(),
                intent: "info",
                confidence: 1.0,
              },
            ]);
          }
        } catch (e: any) {
          console.error("[voice] Transcription error:", e);
          const errMsg = e?.message || String(e);
          let userMsg = "⚠️ **Transcription failed.**\n\n";            if (errMsg.includes('Failed to fetch') || errMsg.includes('NetworkError')) {
              const isDev = import.meta.env.DEV;
              userMsg += isDev
                ? "The backend server is not reachable. Make sure it's running on localhost:8000."
                : "The backend service is currently unavailable. The transcription feature requires the backend to be running — please try again later or type your message instead.";
          } else if (errMsg.includes('timeout') || errMsg.includes('Timeout')) {
            userMsg += "The server took too long to respond. The backend may be starting up — try again in 30 seconds.";
          } else if (errMsg.includes('404') || errMsg.includes('Not Found')) {
            userMsg += "The transcription endpoint is not available on this server. Please restart the backend.";
          } else {
            userMsg += `Error: ${errMsg}\n\nYou can type your message instead.`;
          }
          setMessages((prev) => [
            ...prev,
            {
              role: "kelvin",
              text: userMsg,
              timestamp: new Date().toLocaleTimeString(),
              intent: "error",
              confidence: 0,
            },
          ]);
        }
        setTranscribing(false);
      };

      mediaRecorder.onerror = (event) => {
        console.error("MediaRecorder error:", event);
        setIsRecording(false);
        if (timerRef.current) clearInterval(timerRef.current);
        stream.getTracks().forEach((t) => t.stop());
        setMessages((prev) => [
          ...prev,
          {
            role: "kelvin",
            text: "⚠️ **Recording error.** Please check microphone permissions and try again.",
            timestamp: new Date().toLocaleTimeString(),
            intent: "error",
            confidence: 0,
          },
        ]);
      };

      // Start recording
      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start(100); // Collect data every 100ms
      setIsRecording(true);
      setRecordingTime(0);

      // Start timer
      timerRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);

    } catch (e: any) {
      console.error("Failed to start recording:", e);
      let errorMsg = "⚠️ **Could not access microphone.**";
      if (e.name === "NotAllowedError") {
        errorMsg += "\n\nPlease allow microphone access:\n1. Click the 🔒 lock icon in the address bar\n2. Set Microphone to 'Allow'\n3. Refresh the page";
      } else if (e.name === "NotFoundError") {
        errorMsg += "\n\nNo microphone found. Please connect one and try again.";
      } else {
        errorMsg += `\n\n${e.message || "Unknown error"}`;
      }
      setMessages((prev) => [
        ...prev,
        {
          role: "kelvin",
          text: errorMsg,
          timestamp: new Date().toLocaleTimeString(),
          intent: "error",
          confidence: 0,
        },
      ]);
    }
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const formatMessage = (text: string) => {
    return text
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\n/g, '<br/>');
  };

  const getStatusText = () => {
    if (transcribing) return "🔄 Transcribing audio...";
    if (isRecording) return `🎤 Recording... ${formatTime(recordingTime)}`;
    return "";
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", maxWidth: 900, margin: "0 auto" }}>
      {/* Header */}
      <div
        style={{
          padding: "16px 20px",
          borderBottom: `1px solid ${colors.border}`,
          background: colors.surface,
          borderRadius: "12px 12px 0 0",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              background: "linear-gradient(135deg, #c07a28, #a86018)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 20,
            }}
          >
            🤖
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: colors.text }}>Kelvin AI</h2>
            <p style={{ margin: 0, fontSize: 12, color: colors.textMuted }}>
              RAG-powered • {messages.length - 1} messages
            </p>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              fontSize: 12,
              color: colors.textSecondary,
              cursor: "pointer",
              padding: "4px 10px",
              borderRadius: 8,
              background: autoSpeak ? `${colors.accent}15` : "transparent",
              border: `1px solid ${autoSpeak ? colors.accent : colors.border}`,
              transition: "all 0.2s",
            }}
            onClick={toggleAutoSpeak}
            title={autoSpeak ? "Auto-speak is ON — click to disable" : "Auto-speak is OFF — click to enable"}
          >
            {autoSpeak ? "🔊" : "🔇"}
            Auto-speak
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: colors.textSecondary, cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={useAgents}
              onChange={(e) => setUseAgents(e.target.checked)}
              style={{ accentColor: colors.accent }}
            />
            Multi-Agent
          </label>
        </div>
      </div>

      {/* Messages */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "16px 20px",
          background: colors.bg,
          display: "flex",
          flexDirection: "column",
          gap: 12,
        }}
      >
        {messages.map((msg, i) => (
          <div
            key={i}
            style={{
              display: "flex",
              justifyContent: msg.role === "user" ? "flex-end" : "flex-start",
              animation: "fadeIn 0.3s ease",
            }}
          >
            <div
              style={{
                maxWidth: "80%",
                padding: "12px 16px",
                borderRadius: msg.role === "user" ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
                background: msg.role === "user" ? colors.accent : colors.surface,
                color: msg.role === "user" ? "#fff" : colors.text,
                fontSize: 14,
                lineHeight: 1.6,
                boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
              }}
            >
              {msg.role === "kelvin" && i === messages.length - 1 ? (
                <TypingText text={msg.text} speed={12} />
              ) : (
                <div dangerouslySetInnerHTML={{ __html: formatMessage(msg.text) }} />
              )}

              {msg.role === "kelvin" && (
                <>
                  <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 6 }}>
                    <button
                      onClick={() => handleSpeak(msg.text, i)}
                      style={{
                        padding: "3px 8px",
                        borderRadius: 6,
                        border: `1px solid ${colors.border}`,
                        background: speakingIdx === i ? colors.accent : colors.surfaceHover,
                        color: speakingIdx === i ? "#fff" : colors.textSecondary,
                        cursor: "pointer",
                        fontSize: 12,
                        display: "flex",
                        alignItems: "center",
                        gap: 4,
                        transition: "all 0.15s",
                      }}
                      title={speakingIdx === i ? "Stop speaking" : "Read aloud"}
                    >
                      {speakingIdx === i ? "⏹ Stop" : "🔊 Speak"}
                    </button>
                  </div>
                  <div style={{ marginTop: 8, paddingTop: 8, borderTop: `1px solid ${colors.borderLight}` }}>
                  <div style={{ display: "flex", gap: 12, flexWrap: "wrap", fontSize: 11, color: colors.textMuted }}>
                    {msg.intent && (
                      <span style={{ background: colors.surfaceHover, padding: "2px 8px", borderRadius: 10 }}>
                        📌 {msg.intent}
                      </span>
                    )}
                    {msg.confidence !== undefined && (
                      <span>🎯 {Math.round(msg.confidence * 100)}%</span>
                    )}
                    {msg.response_time_ms && (
                      <span>⏱️ {msg.response_time_ms}ms</span>
                    )}
                    {msg.agents_invoked && msg.agents_invoked.length > 0 && (
                      <span>🤖 {msg.agents_invoked.join(", ")}</span>
                    )}
                  </div>

                  {msg.sources && msg.sources.length > 0 && (
                    <div style={{ marginTop: 6, fontSize: 11 }}>
                      <span style={{ color: colors.textMuted }}>📚 Sources: </span>
                      {msg.sources.map((s, j) => (
                        <span
                          key={j}
                          style={{
                            background: `${colors.accent}15`,
                            color: colors.accent,
                            padding: "1px 6px",
                            borderRadius: 8,
                            marginLeft: 4,
                          }}
                        >
                          {s.title} ({Math.round(s.score * 100)}%)
                        </span>
                      ))}
                    </div>
                  )}

                  {msg.suggestions && msg.suggestions.length > 0 && (
                    <div style={{ marginTop: 8, display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {msg.suggestions.slice(0, 3).map((s, j) => (
                        <button
                          key={j}
                          onClick={() => handleSend(s)}
                          style={{
                            fontSize: 11,
                            padding: "4px 10px",
                            borderRadius: 12,
                            border: `1px solid ${colors.border}`,
                            background: colors.surfaceHover,
                            color: colors.textSecondary,
                            cursor: "pointer",
                            transition: "all 0.15s",
                          }}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                </>
              )}
            </div>
          </div>
        ))}

        {/* Recording status banner */}
        {(isRecording || transcribing) && (
          <div style={{ display: "flex", justifyContent: "center", animation: "fadeIn 0.2s ease" }}>
            <div
              style={{
                padding: "8px 20px",
                borderRadius: 20,
                background: isRecording ? "#fef2f2" : colors.surface,
                border: `1px solid ${isRecording ? "#fca5a5" : colors.border}`,
                fontSize: 13,
                color: isRecording ? "#dc2626" : colors.textSecondary,
                display: "flex",
                alignItems: "center",
                gap: 10,
              }}
            >
              {isRecording && (
                <>
                  <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#dc2626", animation: "recPulse 1s ease-in-out infinite" }} />
                  <span style={{ display: "flex", gap: 3, alignItems: "center" }}>
                    <span style={{ width: 3, height: 12, borderRadius: 2, background: "#dc2626", animation: "soundBar 0.4s ease-in-out infinite alternate" }} />
                    <span style={{ width: 3, height: 18, borderRadius: 2, background: "#dc2626", animation: "soundBar 0.4s ease-in-out 0.1s infinite alternate" }} />
                    <span style={{ width: 3, height: 8, borderRadius: 2, background: "#dc2626", animation: "soundBar 0.4s ease-in-out 0.2s infinite alternate" }} />
                    <span style={{ width: 3, height: 14, borderRadius: 2, background: "#dc2626", animation: "soundBar 0.4s ease-in-out 0.15s infinite alternate" }} />
                  </span>
                </>
              )}
              {transcribing && <span>🔄</span>}
              <span>{getStatusText()}</span>
            </div>
          </div>
        )}

        {loading && (
          <div style={{ display: "flex", justifyContent: "flex-start" }}>
            <div
              style={{
                padding: "12px 16px",
                borderRadius: "16px 16px 16px 4px",
                background: colors.surface,
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <div style={{ display: "flex", gap: 4 }}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: colors.textMuted, animation: "bounce 1.4s infinite ease-in-out both" }} />
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: colors.textMuted, animation: "bounce 1.4s infinite ease-in-out 0.16s both" }} />
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: colors.textMuted, animation: "bounce 1.4s infinite ease-in-out 0.32s both" }} />
              </div>
              <span style={{ fontSize: 12, color: colors.textMuted }}>Kelvin is thinking...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Quick prompts */}
      <div
        style={{
          padding: "8px 16px",
          display: "flex",
          gap: 6,
          overflowX: "auto",
          background: colors.bg,
          borderTop: `1px solid ${colors.borderLight}`,
        }}
      >
        {QUICK_PROMPTS.map((prompt, i) => (
          <button
            key={i}
            onClick={() => handleSend(prompt)}
            disabled={isRecording || transcribing}
            style={{
              fontSize: 11,
              padding: "5px 12px",
              borderRadius: 14,
              border: `1px solid ${colors.border}`,
              background: colors.surface,
              color: colors.textSecondary,
              cursor: "pointer",
              whiteSpace: "nowrap",
              flexShrink: 0,
              transition: "all 0.15s",
              opacity: isRecording || transcribing ? 0.5 : 1,
            }}
          >
            {prompt}
          </button>
        ))}
      </div>

      {/* Input */}
      <div
        style={{
          padding: "12px 16px",
          borderTop: `1px solid ${colors.border}`,
          background: colors.surface,
          display: "flex",
          gap: 8,
          borderRadius: "0 0 12px 12px",
        }}
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
          placeholder={
            isRecording
              ? `🔴 Recording... ${formatTime(recordingTime)} — click ⏹ to stop`
              : transcribing
              ? "🔄 Converting speech to text..."
              : "Ask Kelvin about heat safety, costs, routes, compliance..."
          }
          style={{
            flex: 1,
            padding: "10px 14px",
            borderRadius: 10,
            border: `1px solid ${isRecording ? "#dc2626" : colors.border}`,
            background: isRecording ? "#fef2f2" : colors.bg,
            color: colors.text,
            fontSize: 14,
            outline: "none",
            transition: "all 0.2s",
          }}
          disabled={loading || transcribing}
        />

        {/* Mic / Stop button */}
        <button
          onClick={toggleRecording}
          disabled={loading || transcribing}
          style={{
            width: 40,
            height: 40,
            borderRadius: 10,
            border: `2px solid ${isRecording ? "#dc2626" : colors.border}`,
            background: isRecording ? "#dc2626" : colors.surfaceHover,
            color: "#fff",
            cursor: loading || transcribing ? "not-allowed" : "pointer",
            fontSize: 18,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            animation: isRecording ? "micPulse 1.5s ease-in-out infinite" : "none",
            transition: "all 0.2s",
            flexShrink: 0,
          }}
          title={isRecording ? "Click to STOP recording" : "Click to START voice recording"}
        >
          {isRecording ? "⏹" : "🎤"}
        </button>

        <button
          onClick={() => handleSend()}
          disabled={loading || !input.trim() || isRecording || transcribing}
          style={{
            padding: "10px 20px",
            borderRadius: 10,
            border: "none",
            background: input.trim() ? colors.accent : colors.borderLight,
            color: input.trim() ? "#fff" : colors.textMuted,
            cursor: input.trim() ? "pointer" : "default",
            fontSize: 14,
            fontWeight: 600,
            transition: "all 0.15s",
          }}
        >
          Send
        </button>
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes bounce {
          0%, 80%, 100% { transform: scale(0); }
          40% { transform: scale(1); }
        }
        @keyframes micPulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(220, 38, 38, 0.6); }
          50% { box-shadow: 0 0 0 10px rgba(220, 38, 38, 0); }
        }
        @keyframes recPulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.4; transform: scale(0.8); }
        }
        @keyframes soundBar {
          0% { transform: scaleY(0.3); }
          100% { transform: scaleY(1); }
        }
      `}</style>
    </div>
  );
}
