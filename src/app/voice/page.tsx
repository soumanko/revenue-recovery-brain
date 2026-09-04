"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import {
  Phone,
  PhoneOff,
  Mic,
  User,
  Brain,
  Clock,
  CheckCircle2,
  Volume2,
  Calendar,
  FastForward,
  ShieldAlert,
  CreditCard,
  PlayCircle
} from "lucide-react";
import type { VoiceMessage, RecoveryCampaign, RecoveryCase, ActivityFeedItem } from "@/lib/types";

interface EnrichedCase extends RecoveryCase {
  customer?: { name: string; preferredLanguage: string };
  event?: { failureReason: string; amount: number; eventType: string };
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

export default function VoiceOperationsPage() {
  const [campaigns, setCampaigns] = useState<RecoveryCampaign[]>([]);
  const [cases, setCases] = useState<EnrichedCase[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Voice State
  const [activeVoiceCase, setActiveVoiceCase] = useState<EnrichedCase | null>(null);
  const [transcript, setTranscript] = useState<VoiceMessage[]>([]);
  const [callState, setCallState] = useState<"idle" | "initiating" | "ringing" | "connected" | "speaking" | "processing" | "completed" | "failed">("idle");
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [recovered, setRecovered] = useState(false);
  const [callDuration, setCallDuration] = useState(0);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const transcriptRef = useRef<HTMLDivElement>(null);
  const speechRef = useRef<SpeechSynthesisUtterance | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const [campaignRes, casesRes] = await Promise.all([
        fetch("/api/campaigns"),
        fetch("/api/cases?limit=1000"),
      ]);
      const campaignData = await campaignRes.json();
      const casesData = await casesRes.json();
      setCampaigns(campaignData.campaigns || []);
      setCases(casesData.cases || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 1500);
    return () => clearInterval(interval);
  }, [fetchData]);

  // Voice Loading
  useEffect(() => {
    if (typeof window !== "undefined" && window.speechSynthesis) {
        window.speechSynthesis.getVoices();
        window.speechSynthesis.onvoiceschanged = () => {
            window.speechSynthesis.getVoices();
        };
    }
  }, []);

  const getFemaleIndianVoice = (): SpeechSynthesisVoice | null => {
    if (typeof window === "undefined" || !window.speechSynthesis) return null;
    const voices = window.speechSynthesis.getVoices();
    const preferred = voices.find(v => v.name.includes("Google हिन्दी") || v.name.includes("Microsoft Swara") || v.name.includes("Microsoft Neerja"));
    if (preferred) return preferred;
    return voices.find(v => v.lang.includes("hi-IN") || v.lang.includes("en-IN")) || null;
  };

  const speak = useCallback((text: string): Promise<void> => {
    return new Promise((resolve) => {
      if (typeof window === "undefined" || !window.speechSynthesis) {
        resolve();
        return;
      }
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = "hi-IN";
      utterance.rate = 0.95;
      utterance.pitch = 1;

      const voice = getFemaleIndianVoice();
      if (voice) utterance.voice = voice;

      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => {
        setIsSpeaking(false);
        resolve();
      };
      utterance.onerror = (e) => {
        console.error("Speech synthesis error", e);
        setIsSpeaking(false);
        resolve();
      };
      speechRef.current = utterance;
      window.speechSynthesis.speak(utterance);
    });
  }, []);

  function delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  const startVoiceCall = useCallback(async (c: EnrichedCase) => {
     setActiveVoiceCase(c);
     setCallState("initiating");
     setTranscript([]);
     setCallDuration(0);
     setRecovered(false);

     try {
        await delay(1000);
        setCallState("ringing");
        await delay(2000);
        setCallState("connected");

        const isRahul = (c.customer?.name || "").includes("Rahul");
        const template = isRahul ? demoConversations.rahul : demoConversations.default;
        const conversation = template.map((msg) => ({
            ...msg,
            text: msg.text.replace(/\{amount\}/g, (c.event?.amount || 0).toLocaleString("en-IN")),
            timestamp: new Date().toISOString(),
        }));

        for (let i = 0; i < conversation.length; i++) {
            const msg = conversation[i];
            setTranscript((prev) => [...prev, { ...msg, timestamp: new Date().toISOString() }]);
            
            if (msg.speaker === "agent") {
                setCallState("speaking");
                await speak(msg.text); 
            } else {
                setCallState("connected");
                await delay(1500);
            }
        }

        setCallState("processing");

        // Execute API if it was only scheduled
        if (c.state === "VOICE_SCHEDULED") {
            const response = await fetch("/api/agent/process", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ caseId: c.id, requestedAction: "execute_voice_recovery" }),
            });
            const data = await response.json();
            
            await delay(1500);
            
            if (data.success && data.case.state === "RECOVERED") {
                setRecovered(true);
                setCallState("completed");
                await speak(`Payment successfully complete ho gaya. Rupees ${(c.event?.amount || 0).toLocaleString("en-IN")} recovered.`);
            } else {
                setRecovered(false);
                setCallState("failed");
                await speak(`Payment complete nahi ho paya. Recovery policy ke according next action decide ki ja rahi hai.`);
            }
        } else {
             // It was already executing, wait for it to resolve in the backend state loop
             await delay(3000);
             setCallState("completed");
             setRecovered(true); // just assume success for demo if backend is handling it
        }

     } catch (e) {
         console.error(e);
     } finally {
         setTimeout(() => {
             setCallState("idle");
             setActiveVoiceCase(null);
         }, 5000);
     }
  }, [speak]);

  // Monitor backend for active voice cases
  useEffect(() => {
     if (callState !== "idle") return; // Already handling a call
     
     // Find if the backend set any case to ACTION_EXECUTING and it's a voice call
     const executingVoice = cases.find(c => c.state === "ACTION_EXECUTING" && (c.selectedAction === "execute_voice_recovery" || c.selectedAction === "hinglish_voice_call"));
     
     // OR find a scheduled voice call that we can manually trigger (or auto trigger in a real app)
     // For demo purposes, we will auto trigger VOICE_SCHEDULED if its time has come.
     const scheduledVoice = cases.find(c => c.state === "VOICE_SCHEDULED" && c.scheduledFor && new Date(c.scheduledFor).getTime() <= Date.now());

     if (executingVoice || scheduledVoice) {
         startVoiceCall(executingVoice || scheduledVoice!);
     }
  }, [cases, callState, startVoiceCall]);


  const manualTriggerVoice = (c: EnrichedCase) => {
      startVoiceCall(c);
  }

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

  useEffect(() => {
    if (transcriptRef.current) {
      transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight;
    }
  }, [transcript]);


  if (loading && campaigns.length === 0) {
    return <div className="p-10 text-center"><div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" /></div>;
  }

  const activeCampaign = campaigns.find(c => c.status === "RUNNING") || campaigns[0];
  const campaignCases = activeCampaign ? cases.filter(c => activeCampaign.targetCaseIds.includes(c.id)) : [];
  
  const voiceScheduled = campaignCases.filter(c => c.state === "VOICE_SCHEDULED");

  const formatCallDuration = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${String(s).padStart(2, "0")}`;
  };

  return (
    <div className="p-6 max-w-[1440px] mx-auto space-y-6 fade-in min-h-screen">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Autonomous Voice Operations</h1>
          <p className="text-[var(--color-text-muted)] text-sm mt-1 flex items-center gap-2">
            <span className="flex items-center gap-1.5 text-cyan-400">
               <span className="w-2 h-2 rounded-full bg-cyan-400 pulse-dot" />
               VOICE ENGINE ACTIVE
            </span>
          </p>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-6">
         {/* LEFT PANEL */}
         <div className="col-span-12 lg:col-span-4 space-y-6">
            <div className="glass-card p-5">
               <h3 className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-4">Operations Status</h3>
               <div className="space-y-4">
                  <div className="flex justify-between items-center text-sm">
                     <span className="text-[var(--color-text-muted)]">Current Campaign</span>
                     <span className="font-semibold text-emerald-400">{activeCampaign?.name || "None"}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                     <span className="text-[var(--color-text-muted)]">Remaining in Queue</span>
                     <span className="font-mono">{campaignCases.filter(c => !["RECOVERED","STOPPED","ESCALATED"].includes(c.state)).length}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                     <span className="text-[var(--color-text-muted)]">Voice Calls Scheduled</span>
                     <span className="font-mono text-cyan-400">{voiceScheduled.length}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                     <span className="text-[var(--color-text-muted)]">Total Recovered</span>
                     <span className="font-mono text-emerald-400">{campaignCases.filter(c => c.state === "RECOVERED").length}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                     <span className="text-[var(--color-text-muted)]">Human Intervention</span>
                     <span className="font-mono text-red-400">{campaignCases.filter(c => c.state === "ESCALATED").length}</span>
                  </div>
               </div>
            </div>

            {/* Manual Override Demo list */}
            <div className="glass-card p-5">
               <h3 className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-4">Manual Override (Demo)</h3>
               <div className="space-y-2 max-h-[300px] overflow-y-auto">
                 {campaignCases.slice(0, 10).map((c) => (
                   <div key={c.id} className="flex justify-between items-center p-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-primary)]">
                      <div>
                        <p className="text-sm font-medium">{c.customer?.name}</p>
                        <p className="text-xs text-amber-400">{formatINR(c.event?.amount || 0)}</p>
                      </div>
                      <button 
                        disabled={callState !== "idle"}
                        onClick={() => manualTriggerVoice(c)}
                        className="px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-[10px] uppercase font-bold disabled:opacity-50 transition-colors"
                      >
                         Force Call
                      </button>
                   </div>
                 ))}
               </div>
            </div>
         </div>

         {/* RIGHT PANEL - ACTIVE CALL */}
         <div className="col-span-12 lg:col-span-8">
            <div className="glass-card h-[600px] flex flex-col overflow-hidden">
               {/* Call Header */}
               <div className="px-6 py-5 border-b border-[var(--color-border)] bg-[var(--color-bg-primary)] flex justify-between items-center">
                   {activeVoiceCase ? (
                      <div className="flex items-center gap-4">
                         <div className="w-12 h-12 rounded-full bg-cyan-500/10 flex items-center justify-center">
                            <Phone className={`w-5 h-5 text-cyan-400 ${callState === "ringing" ? "animate-pulse" : ""}`} />
                         </div>
                         <div>
                            <h2 className="text-lg font-bold">{activeVoiceCase.customer?.name}</h2>
                            <p className="text-sm text-emerald-400">{formatINR(activeVoiceCase.event?.amount || 0)} <span className="text-[var(--color-text-muted)] mx-1">•</span> <span className="capitalize">{callState}</span></p>
                         </div>
                      </div>
                   ) : (
                      <div className="flex items-center gap-4">
                         <div className="w-12 h-12 rounded-full bg-[var(--color-bg-card)] flex items-center justify-center">
                            <Clock className="w-5 h-5 text-[var(--color-text-muted)]" />
                         </div>
                         <div>
                            <h2 className="text-lg font-bold text-[var(--color-text-muted)]">Waiting for Agent...</h2>
                            <p className="text-sm text-[var(--color-text-muted)]">No active call</p>
                         </div>
                      </div>
                   )}
                   
                   {activeVoiceCase && callState !== "idle" && (
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-[var(--color-text-muted)]" />
                        <span className="text-sm font-mono text-[var(--color-text-secondary)]">{formatCallDuration(callDuration)}</span>
                      </div>
                   )}
               </div>

               {/* Transcript Area */}
               <div className="flex-1 bg-[var(--color-bg-card)] p-6 relative flex flex-col">
                  {!activeVoiceCase ? (
                     <div className="flex-1 flex flex-col justify-center items-center text-center opacity-50">
                        <Brain className="w-16 h-16 text-cyan-400 mb-4" />
                        <p className="text-lg text-[var(--color-text-secondary)] font-medium">Monitoring Queue</p>
                        <p className="text-sm text-[var(--color-text-muted)]">The agent will autonomously connect to scheduled customers.</p>
                     </div>
                  ) : (
                     <>
                        <div ref={transcriptRef} className="flex-1 overflow-y-auto space-y-4 pr-2 pb-20">
                          {transcript.map((msg, i) => (
                            <div key={i} className={`flex gap-4 slide-up ${msg.speaker === "agent" ? "" : "flex-row-reverse"}`}>
                              <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 border ${
                                msg.speaker === "agent" ? "bg-cyan-500/10 border-cyan-500/30 text-cyan-400" : "bg-purple-500/10 border-purple-500/30 text-purple-400"
                              }`}>
                                {msg.speaker === "agent" ? <Brain className="w-5 h-5" /> : <User className="w-5 h-5" />}
                              </div>
                              <div className={`max-w-[70%] ${msg.speaker === "agent" ? "" : "text-right"}`}>
                                <div className={`rounded-2xl px-5 py-3 text-sm shadow-sm ${
                                  msg.speaker === "agent" ? "bg-[var(--color-bg-primary)] border border-[var(--color-border)] rounded-tl-sm" : "bg-purple-500/20 border border-purple-500/30 rounded-tr-sm"
                                }`}>
                                  {msg.text}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>

                        {/* Call Visualizer Footer */}
                        <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-[var(--color-bg-card)] via-[var(--color-bg-card)] to-transparent flex justify-center">
                           <div className="px-8 py-3 rounded-full bg-[var(--color-bg-primary)] border border-[var(--color-border)] shadow-lg flex items-center gap-3">
                              {callState === "speaking" || isSpeaking ? (
                                <div className="wave-bars">
                                  {[...Array(12)].map((_, i) => (
                                    <div key={i} className="wave-bar bg-cyan-400" style={{ animationDelay: `${i * 0.08}s` }} />
                                  ))}
                                </div>
                              ) : callState === "ringing" ? (
                                <div className="flex items-center gap-2">
                                  <Phone className="w-4 h-4 text-cyan-400 animate-pulse" />
                                  <span className="text-xs font-semibold text-cyan-400">Ringing...</span>
                                </div>
                              ) : (
                                <div className="flex items-center gap-2">
                                  <Mic className="w-4 h-4 text-emerald-400 pulse-dot" />
                                  <span className="text-xs font-semibold text-emerald-400">Listening...</span>
                                </div>
                              )}
                           </div>
                        </div>
                     </>
                  )}
               </div>
            </div>
         </div>
      </div>
    </div>
  );
}
