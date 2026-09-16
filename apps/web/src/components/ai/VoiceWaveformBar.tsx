"use client";

import React, { useEffect, useRef, useState } from "react";
import { Plus, Square } from "lucide-react";
import { useThemeStore } from "@/store/theme.store";

interface VoiceWaveformBarProps {
  isListening: boolean;
  isSpeaking: boolean;
  audioLevel?: number;
  mediaStream?: MediaStream | null;
  onStop: () => void;
  onAttachClick?: () => void;
}

const TOTAL_BARS = 43;
const CENTER_INDEX = Math.floor(TOTAL_BARS / 2); // 21

export function VoiceWaveformBar({
  isListening,
  isSpeaking,
  audioLevel = 0,
  mediaStream,
  onStop,
  onAttachClick,
}: VoiceWaveformBarProps) {
  const { theme } = useThemeStore();
  const isDark = theme === "dark";

  const [barHeights, setBarHeights] = useState<number[]>(() =>
    Array(TOTAL_BARS).fill(2.5)
  );

  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const barHeightsRef = useRef<number[]>(Array(TOTAL_BARS).fill(2.5));

  // Initialize Web Audio API Analyser when mediaStream is provided
  useEffect(() => {
    if (!isListening || !mediaStream) {
      if (audioContextRef.current && audioContextRef.current.state !== "closed") {
        try {
          audioContextRef.current.close().catch(() => {});
        } catch {}
        audioContextRef.current = null;
      }
      analyserRef.current = null;
      return;
    }

    try {
      const AudioContextClass =
        window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;

      const ctx = new AudioContextClass();
      audioContextRef.current = ctx;

      const source = ctx.createMediaStreamSource(mediaStream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 64;
      analyser.smoothingTimeConstant = 0.5;
      source.connect(analyser);
      analyserRef.current = analyser;
    } catch (e) {
      console.warn("AudioContext init error:", e);
    }

    return () => {
      if (audioContextRef.current && audioContextRef.current.state !== "closed") {
        try {
          audioContextRef.current.close().catch(() => {});
        } catch {}
        audioContextRef.current = null;
      }
      analyserRef.current = null;
    };
  }, [isListening, mediaStream]);

  // 60FPS animation loop for dynamic audio waveform
  useEffect(() => {
    if (!isListening) {
      setBarHeights(Array(TOTAL_BARS).fill(2.5));
      barHeightsRef.current = Array(TOTAL_BARS).fill(2.5);
      return;
    }

    let time = 0;
    const freqData = new Uint8Array(32);

    const updateFrame = () => {
      time += 0.05;

      // Read real frequency spectrum if available
      let realVol = audioLevel;
      if (analyserRef.current) {
        analyserRef.current.getByteFrequencyData(freqData);
        let sum = 0;
        for (let i = 0; i < freqData.length; i++) {
          sum += freqData[i];
        }
        const computedAvg = sum / freqData.length / 255;
        if (computedAvg > 0.01) {
          realVol = computedAvg;
        }
      }

      // Check if actively speaking (volume above baseline)
      const userSpeaking = isSpeaking || realVol > 0.035;
      const newHeights = [...barHeightsRef.current];

      for (let i = 0; i < TOTAL_BARS; i++) {
        // Distance from center normalized to 0.0 (center) .. 1.0 (edges)
        const dist = Math.abs(i - CENTER_INDEX) / CENTER_INDEX;
        let targetHeight = 2.5;

        if (userSpeaking) {
          // SPEAKING STATE:
          // Wave pattern widens and scales taller with speech volume
          const activeSpread = Math.min(0.35 + realVol * 2.2, 0.95);

          if (dist <= activeSpread) {
            const envelope = Math.cos((dist / activeSpread) * (Math.PI / 2));
            const freqIndex = Math.floor((1 - dist) * 15);
            const freqVal = (freqData[freqIndex] || 0) / 255;

            const harmonic =
              Math.sin(time * 3.5 + i * 0.45) * 0.25 +
              Math.cos(time * 2.2 - i * 0.3) * 0.25 +
              0.5;

            const voiceIntensity = Math.max(realVol * 1.5, freqVal * 1.2, 0.2);
            targetHeight =
              3 + envelope * voiceIntensity * (18 + harmonic * 10);
            targetHeight = Math.min(Math.max(targetHeight, 2.5), 28);
          } else {
            targetHeight = 2.5;
          }
        } else {
          // SILENT / NORMAL STATE:
          // Wave pattern is normal, calm, resting baseline
          if (dist < 0.25) {
            const breathing = Math.sin(time * 1.8 + i * 0.3) * 0.8;
            targetHeight = 4.5 + (1 - dist * 4) * 2.5 + breathing;
          } else if (dist < 0.45) {
            targetHeight = 3.2;
          } else {
            targetHeight = 2.5;
          }
        }

        // Smooth exponential moving average for fluid motion
        newHeights[i] = newHeights[i] * 0.65 + targetHeight * 0.35;
      }

      barHeightsRef.current = newHeights;
      setBarHeights(newHeights);

      animFrameRef.current = requestAnimationFrame(updateFrame);
    };

    animFrameRef.current = requestAnimationFrame(updateFrame);

    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, [isListening, isSpeaking, audioLevel]);

  if (!isListening) return null;

  // Day vs Night palette
  const barSilentColor = isDark ? "rgba(148, 163, 184, 0.7)" : "rgba(71, 85, 105, 0.65)";
  const barSpeakingColor = isDark ? "#60A5FA" : "var(--brand-primary)";
  const stopBg = isDark ? "rgba(255, 255, 255, 0.12)" : "rgba(15, 23, 42, 0.08)";
  const stopHoverBg = isDark ? "rgba(255, 255, 255, 0.22)" : "rgba(15, 23, 42, 0.16)";
  const stopIconColor = isDark ? "#FFFFFF" : "var(--slate-800)";

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        width: "100%",
        height: "100%",
        gap: "8px",
      }}
    >
      {/* Left Attachment / Plus Button */}
      <button
        type="button"
        onClick={onAttachClick}
        title="Attach files, images or docs"
        style={{
          width: "36px",
          height: "36px",
          borderRadius: "50%",
          border: "none",
          background: "transparent",
          color: "var(--text-secondary)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          transition: "all 0.15s ease",
          flexShrink: 0,
        }}
        onMouseOver={(e) => {
          e.currentTarget.style.color = "var(--text-primary)";
          e.currentTarget.style.background = isDark
            ? "rgba(255, 255, 255, 0.08)"
            : "rgba(0, 0, 0, 0.05)";
        }}
        onMouseOut={(e) => {
          e.currentTarget.style.color = "var(--text-secondary)";
          e.currentTarget.style.background = "transparent";
        }}
      >
        <Plus size={18} />
      </button>

      {/* Center: Dynamic Audio Waveform */}
      <div
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "34px",
          gap: "2.5px",
          overflow: "hidden",
          padding: "0 4px",
        }}
      >
        {barHeights.map((height, idx) => {
          const dist = Math.abs(idx - CENTER_INDEX) / CENTER_INDEX;
          const isMinimalDot = height <= 3;
          const opacity = isMinimalDot ? 0.45 : 0.85 + (1 - dist) * 0.15;

          return (
            <span
              key={idx}
              style={{
                width: "2.5px",
                height: `${height.toFixed(1)}px`,
                borderRadius: "9999px",
                background: isSpeaking ? barSpeakingColor : barSilentColor,
                opacity,
                transition: "background-color 0.2s ease",
                flexShrink: 0,
              }}
            />
          );
        })}
      </div>

      {/* Right: Stop Recording Button (Square ■) */}
      <button
        type="button"
        onClick={onStop}
        title="Stop recording"
        style={{
          width: "34px",
          height: "34px",
          borderRadius: "50%",
          border: isDark ? "1px solid rgba(255,255,255,0.15)" : "1px solid var(--border-default)",
          background: stopBg,
          color: stopIconColor,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          transition: "all 0.15s ease",
          flexShrink: 0,
        }}
        onMouseOver={(e) => {
          e.currentTarget.style.background = stopHoverBg;
        }}
        onMouseOut={(e) => {
          e.currentTarget.style.background = stopBg;
        }}
      >
        <Square size={13} fill={stopIconColor} stroke="none" />
      </button>
    </div>
  );
}
