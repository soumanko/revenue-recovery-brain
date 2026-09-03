"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  Phone,
  PhoneOff,
  Mic,
  MicOff,
  User,
  Brain,
  Clock,
  CheckCircle2,
  Volume2,
  Target,
  Zap,
} from "lucide-react";
import type { VoiceMessage } from "@/lib/types";

interface VoiceDemoCase {
  caseId: string;
  customerId: string;
  customerName: string;
  amount: number;
  failureReason: string;
  recoveryScore: number;
  eventType: string;
  whyVoice: string;
}

// Pre-built demo conversations
const demoConversations: Record<string, VoiceMessage[]> = {
  default: [
    { speaker: "agent", text: "Namaste! Main Revenue Recovery Brain se bol raha hoon. Kya aap abhi baat kar sakte hain?", timestamp: "", isHinglish: true },
    { speaker: "customer", text: "Haan, boliye.", timestamp: "", isHinglish: true },
    { speaker: "agent", text: "Aapka recent payment complete nahi ho paya tha. Bank ki taraf se temporary issue tha. Kya aap payment dobara try karna chahenge?", timestamp: "", isHinglish: true },
    { speaker: "customer", text: "Haan, kar do. Kitna amount hai?", timestamp: "", isHinglish: true },
    { speaker: "agent", text: "Amount hai ₹{amount}. Main abhi payment retry kar raha hoon...", timestamp: "", isHinglish: true },
    { speaker: "agent", text: "Payment successfully complete ho gaya hai! ₹{amount} recover ho gaya. Dhanyavaad!", timestamp: "", isHinglish: true },
  ],
  rahul: [
    { speaker: "agent", text: "Namaste Rahul ji, main Revenue Recovery Brain se bol raha hoon.", timestamp: "", isHinglish: true },
    { speaker: "customer", text: "Haan, boliye.", timestamp: "", isHinglish: true },
    { speaker: "agent", text: "Rahul ji, aapka ₹{amount} ka payment complete nahi ho paya tha. Bank timeout ki wajah se issue hua tha. Kya aap payment dobara try karna chahenge?", timestamp: "", isHinglish: true },
    { speaker: "customer", text: "Haan, kar do.", timestamp: "", isHinglish: true },
    { speaker: "agent", text: "Bilkul. Main payment retry kar raha hoon... please hold karein.", timestamp: "", isHinglish: true },
    { speaker: "agent", text: "Payment successfully complete ho gaya hai! ₹{amount} recover ho gaya. Thank you Rahul ji!", timestamp: "", isHinglish: true },
  ],
};

function formatINR(amount: number): string {
  return `₹${amount.toLocaleString("en-IN")}`;
}

export default function VoicePage() {
  const [cases, setCases] = useState<VoiceDemoCase[]>([]);
  const [selectedCase, setSelectedCase] = useState<VoiceDemoCase | null>(null);
  const [callState, setCallState] = useState<"idle" | "initiating" | "ringing" | "connected" | "speaking" | "processing" | "completed" | "failed">("idle");
  const [transcript, setTranscript] = useState<VoiceMessage[]>([]);
  const [callDuration, setCallDuration] = useState(0);
  const [currentMessageIndex, setCurrentMessageIndex] = useState(-1);
  const [recovered, setRecovered] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const transcriptRef = useRef<HTMLDivElement>(null);
  const speechRef = useRef<SpeechSynthesisUtterance | null>(null);

  // Fetch eligible cases
  useEffect(() => {
    fetch("/api/cases?limit=500")
      .then((r) => r.json())
      .then((data) => {
        const eligible = (data.cases || [])
          .filter((c: { amountAtRisk: number; event?: { failureReason: string; eventType: string }; customer?: { preferredLanguage: string; name: string } }) =>
            c.amountAtRisk >= 2000 &&
            c.event?.failureReason !== "card_expired" &&
            c.event?.failureReason !== "card_declined" &&
            c.event?.eventType === "payment_failure"
          )
          .slice(0, 10)
          .map((c: { id: string; customerId: string; customer?: { name: string }; amountAtRisk: number; event?: { failureReason: string; eventType: string }; recoveryScore?: number }) => ({
            caseId: c.id,
            customerId: c.customerId,
            customerName: c.customer?.name || "Customer",
            amount: c.amountAtRisk,
            failureReason: c.event?.failureReason || "unknown",
            recoveryScore: c.recoveryScore || 75,
            eventType: c.event?.eventType || "payment_failure",
            whyVoice: `Voice recovery selected because transaction value (₹${c.amountAtRisk.toLocaleString("en-IN")}) exceeds voice threshold and customer has a high recovery probability. Hinglish communication preferred.`,
          }));

        setCases(eligible);
        // Auto-select first case (Rahul's case if available)
        if (eligible.length > 0) {
          const rahulCase = eligible.find((c: VoiceDemoCase) => c.customerName.includes("Rahul"));
          setSelectedCase(rahulCase || eligible[0]);
        }
      });
  }, []);

  // Call duration timer
  useEffect(() => {
    if (callState === "connected" || callState === "speaking") {
      timerRef.current = setInterval(() => {
        setCallDuration((d) => d + 1);
      }, 1000);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [callState]);

  // Scroll transcript
  useEffect(() => {
    if (transcriptRef.current) {
      transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight;
    }
  }, [transcript]);

  const speak = useCallback((text: string) => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;

    // Cancel any ongoing speech
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "hi-IN";
    utterance.rate = 0.95;
    utterance.pitch = 1;

    // Try to find a Hindi voice
    const voices = window.speechSynthesis.getVoices();
    const hindiVoice = voices.find((v) => v.lang.includes("hi")) || voices.find((v) => v.lang.includes("en-IN"));
    if (hindiVoice) utterance.voice = hindiVoice;

    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);

    speechRef.current = utterance;
    window.speechSynthesis.speak(utterance);
  }, []);

  const startCall = useCallback(async () => {
    if (!selectedCase) return;

    setCallState("initiating");
    setTranscript([]);
    setCallDuration(0);
    setRecovered(false);
    setCurrentMessageIndex(-1);

    // Simulate call initiation
    await delay(1000);
    setCallState("ringing");
    await delay(2000);
    setCallState("connected");

    // Get conversation template
    const isRahul = selectedCase.customerName.includes("Rahul");
    const template = isRahul ? demoConversations.rahul : demoConversations.default;
    const conversation = template.map((msg) => ({
      ...msg,
      text: msg.text.replace(/\{amount\}/g, selectedCase.amount.toLocaleString("en-IN")),
      timestamp: new Date().toISOString(),
    }));

    // Play conversation
    for (let i = 0; i < conversation.length; i++) {
      const msg = conversation[i];
      setCurrentMessageIndex(i);

      if (msg.speaker === "agent") {
        setCallState("speaking");
        speak(msg.text);
        await delay(msg.text.length * 60 + 1500);
      } else {
        setCallState("connected");
        await delay(1500);
      }

      setTranscript((prev) => [...prev, { ...msg, timestamp: new Date().toISOString() }]);
    }

    // Process recovery
    setCallState("processing");
    await delay(1500);

    // Execute actual recovery via API
    try {
      const response = await fetch("/api/agent/process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ caseId: selectedCase.caseId, requestedAction: "hinglish_voice_call" }),
      });
      const data = await response.json();

      if (data.success && data.case.state === "RECOVERED") {
        setRecovered(true);
        setCallState("completed");
        speak(`Payment successfully complete ho gaya. Rupees ${selectedCase.amount.toLocaleString("en-IN")} recovered.`);
      } else {
        setRecovered(false);
        setCallState("failed");
        speak(`Payment complete nahi ho paya. Recovery policy ke according next action decide ki ja rahi hai.`);
      }
    } catch (e) {
      setRecovered(false);
      setCallState("failed");
    }

    if (timerRef.current) clearInterval(timerRef.current);
  }, [selectedCase, speak]);

  const endCall = () => {
    if (typeof window !== "undefined") window.speechSynthesis?.cancel();
    setCallState("idle");
    setIsSpeaking(false);
    if (timerRef.current) clearInterval(timerRef.current);
  };

  const formatCallDuration = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${String(s).padStart(2, "0")}`;
  };

  return (
    <div className="p-6 max-w-[1200px] mx-auto space-y-6 fade-in">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Hinglish Voice Recovery</h1>
        <p className="text-[var(--color-text-muted)] text-sm mt-1">
          AI-powered voice recovery with natural Hinglish conversation • Demo Mode
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Case Selection + Info */}
        <div className="space-y-4">
          {/* Case Selector */}
          <div className="glass-card p-5">
            <h3 className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-3">
              Select Customer
            </h3>
            <div className="space-y-2 max-h-[300px] overflow-y-auto">
              {cases.map((c) => (
                <button
                  key={c.caseId}
                  onClick={() => { setSelectedCase(c); setCallState("idle"); setTranscript([]); setRecovered(false); }}
                  className={`w-full text-left p-3 rounded-xl transition-all ${
                    selectedCase?.caseId === c.caseId
                      ? "bg-emerald-500/15 border border-emerald-500/30"
                      : "bg-[var(--color-bg-primary)] hover:bg-[var(--color-bg-card-hover)] border border-transparent"
                  }`}
                >
                  <p className="text-sm font-medium">{c.customerName}</p>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-xs text-amber-400">{formatINR(c.amount)}</span>
                    <span className="text-[10px] text-[var(--color-text-muted)]">{c.failureReason.replace(/_/g, " ")}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Case Info */}
          {selectedCase && (
            <div className="glass-card p-5 space-y-3">
              <h3 className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">
                Recovery Details
              </h3>
              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-[var(--color-text-muted)]">Customer</span>
                  <span className="font-medium">{selectedCase.customerName}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-[var(--color-text-muted)]">Amount</span>
                  <span className="font-medium text-amber-400">{formatINR(selectedCase.amount)}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-[var(--color-text-muted)]">Failure</span>
                  <span>{selectedCase.failureReason.replace(/_/g, " ")}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-[var(--color-text-muted)]">Recovery Score</span>
                  <span className="text-emerald-400 font-semibold">{selectedCase.recoveryScore}%</span>
                </div>
              </div>

              <div className="mt-3 pt-3 border-t border-[var(--color-border)]">
                <div className="flex items-start gap-2">
                  <Brain className="w-3.5 h-3.5 text-cyan-400 mt-0.5 shrink-0" />
                  <p className="text-[10px] text-[var(--color-text-secondary)] leading-relaxed italic">
                    {selectedCase.whyVoice}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Center: Voice Interface */}
        <div className="lg:col-span-2">
          <div className="glass-card overflow-hidden">
            {/* Call Header */}
            <div className={`px-6 py-4 flex items-center justify-between ${
              callState === "completed" && recovered ? "bg-emerald-500/10" :
              callState !== "idle" ? "bg-cyan-500/10" : ""
            }`}>
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                  callState === "idle" ? "bg-[var(--color-bg-primary)]" :
                  callState === "completed" && recovered ? "bg-emerald-500/20" :
                  "bg-cyan-500/20"
                }`}>
                  {callState === "completed" && recovered ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                  ) : callState === "speaking" || isSpeaking ? (
                    <Volume2 className="w-5 h-5 text-cyan-400" />
                  ) : (
                    <Phone className="w-5 h-5 text-[var(--color-text-muted)]" />
                  )}
                </div>
                <div>
                  <p className="text-sm font-semibold">
                    {selectedCase ? selectedCase.customerName : "Select a customer"}
                  </p>
                  <p className="text-xs text-[var(--color-text-muted)]">
                    {callState === "idle" && "Ready to call"}
                    {callState === "initiating" && "Initiating call..."}
                    {callState === "ringing" && "Ringing..."}
                    {callState === "connected" && "Connected — Listening"}
                    {callState === "speaking" && "Agent Speaking"}
                    {callState === "processing" && "Processing recovery..."}
                    {callState === "completed" && (recovered ? "Recovery Successful" : "Call Ended")}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                {callState !== "idle" && callState !== "completed" && (
                  <div className="flex items-center gap-2">
                    <Clock className="w-3.5 h-3.5 text-[var(--color-text-muted)]" />
                    <span className="text-xs font-mono">{formatCallDuration(callDuration)}</span>
                  </div>
                )}
                {callState === "completed" && (
                  <span className="text-xs font-mono text-[var(--color-text-muted)]">{formatCallDuration(callDuration)}</span>
                )}
              </div>
            </div>

            {/* Voice Visualizer */}
            {(callState === "speaking" || callState === "connected" || callState === "ringing") && (
              <div className="px-6 py-4 flex justify-center items-center gap-1 bg-[var(--color-bg-primary)]">
                {callState === "speaking" || isSpeaking ? (
                  <div className="wave-bars">
                    {[...Array(12)].map((_, i) => (
                      <div key={i} className="wave-bar" style={{ animationDelay: `${i * 0.08}s` }} />
                    ))}
                  </div>
                ) : callState === "ringing" ? (
                  <div className="flex items-center gap-2">
                    <Phone className="w-4 h-4 text-cyan-400 animate-pulse" />
                    <span className="text-xs text-[var(--color-text-muted)]">Ringing...</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <Mic className="w-4 h-4 text-emerald-400 pulse-dot" />
                    <span className="text-xs text-[var(--color-text-muted)]">Listening...</span>
                  </div>
                )}
              </div>
            )}

            {/* Transcript */}
            <div ref={transcriptRef} className="px-6 py-4 space-y-4 min-h-[300px] max-h-[400px] overflow-y-auto">
              {transcript.length === 0 && callState === "idle" && (
                <div className="flex flex-col items-center justify-center h-[250px] text-center">
                  <Phone className="w-10 h-10 text-[var(--color-text-muted)] opacity-30 mb-3" />
                  <p className="text-sm text-[var(--color-text-muted)]">
                    Start a Hinglish voice recovery call
                  </p>
                  <p className="text-xs text-[var(--color-text-muted)] mt-1">
                    Select a customer and click the call button below
                  </p>
                </div>
              )}

              {transcript.map((msg, i) => (
                <div
                  key={i}
                  className={`flex gap-3 slide-up ${msg.speaker === "agent" ? "" : "flex-row-reverse"}`}
                >
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                    msg.speaker === "agent" ? "bg-cyan-500/20" : "bg-purple-500/20"
                  }`}>
                    {msg.speaker === "agent" ? (
                      <Brain className="w-4 h-4 text-cyan-400" />
                    ) : (
                      <User className="w-4 h-4 text-purple-400" />
                    )}
                  </div>
                  <div className={`max-w-[75%] ${msg.speaker === "agent" ? "" : "text-right"}`}>
                    <p className="text-[10px] text-[var(--color-text-muted)] mb-1">
                      {msg.speaker === "agent" ? "Recovery Agent" : selectedCase?.customerName || "Customer"}
                    </p>
                    <div className={`rounded-2xl px-4 py-2.5 text-sm ${
                      msg.speaker === "agent"
                        ? "bg-[var(--color-bg-card)] rounded-tl-md"
                        : "bg-purple-500/15 rounded-tr-md"
                    }`}>
                      {msg.text}
                    </div>
                    {msg.isHinglish && (
                      <span className="text-[9px] text-[var(--color-text-muted)] mt-0.5 inline-block">🇮🇳 Hinglish</span>
                    )}
                  </div>
                </div>
              ))}

              {callState === "processing" && (
                <div className="flex items-center justify-center gap-2 py-4">
                  <div className="w-4 h-4 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                  <span className="text-xs text-[var(--color-text-muted)]">Processing recovery payment...</span>
                </div>
              )}
            </div>

            {/* Recovery Result */}
            {callState === "completed" && recovered && (
              <div className="px-6 py-5 bg-emerald-500/10 border-t border-emerald-500/20 slide-up">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="w-6 h-6 text-emerald-400" />
                    <div>
                      <p className="text-sm font-semibold text-emerald-400">Payment Recovered!</p>
                      <p className="text-xs text-[var(--color-text-muted)]">Via Hinglish Voice Call</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-emerald-400 recovery-glow">
                      {selectedCase ? formatINR(selectedCase.amount) : "—"}
                    </p>
                    <p className="text-xs text-[var(--color-text-muted)]">
                      Duration: {formatCallDuration(callDuration)} • 1 attempt
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Call Controls */}
            <div className="px-6 py-4 border-t border-[var(--color-border)] flex items-center justify-center gap-4">
              {callState === "idle" ? (
                <button
                  onClick={startCall}
                  disabled={!selectedCase}
                  className="flex items-center gap-2 px-8 py-3 rounded-full bg-gradient-to-r from-emerald-600 to-cyan-600 text-white font-semibold text-sm hover:from-emerald-500 hover:to-cyan-500 transition-all shadow-lg shadow-emerald-900/30 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Phone className="w-4 h-4" />
                  Start Voice Recovery
                </button>
              ) : callState === "completed" ? (
                <button
                  onClick={() => { setCallState("idle"); setTranscript([]); setRecovered(false); setCallDuration(0); }}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-full border border-[var(--color-border)] text-sm font-medium hover:bg-[var(--color-bg-card)] transition-all"
                >
                  <Phone className="w-4 h-4" />
                  New Call
                </button>
              ) : (
                <button
                  onClick={endCall}
                  className="flex items-center gap-2 px-8 py-3 rounded-full bg-red-600 text-white font-semibold text-sm hover:bg-red-500 transition-all"
                >
                  <PhoneOff className="w-4 h-4" />
                  End Call
                </button>
              )}
            </div>

            {/* Simulation Notice */}
            <div className="px-6 py-2 bg-amber-500/5 border-t border-amber-500/10">
              <p className="text-[10px] text-amber-400/70 text-center">
                ⚡ Demo Simulation — Uses Web Speech API for TTS. All recovery actions are simulated.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
