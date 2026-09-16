"use client";

import { useState, useEffect, useRef, useCallback } from "react";

// Cross-browser SpeechRecognition types
interface SpeechRecognitionErrorEvent extends Event {
  error: string;
  message?: string;
}

interface SpeechRecognitionEvent extends Event {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}

interface UseSpeechRecognitionOptions {
  lang?: string;
  continuous?: boolean;
  interimResults?: boolean;
  onTranscriptChange?: (text: string) => void;
  onResult?: (text: string) => void;
  onError?: (errorMsg: string) => void;
  onStart?: () => void;
  onEnd?: () => void;
}

export function useSpeechRecognition({
  lang,
  continuous = true,
  interimResults = true,
  onTranscriptChange,
  onResult,
  onError,
  onStart,
  onEnd,
}: UseSpeechRecognitionOptions = {}) {
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [interimTranscript, setInterimTranscript] = useState("");
  const [isSupported, setIsSupported] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [audioLevel, setAudioLevel] = useState(0);
  const [mediaStream, setMediaStream] = useState<MediaStream | null>(null);

  const recognitionRef = useRef<any>(null);
  const isListeningRef = useRef(false);
  const intentionalStopRef = useRef(false);
  const accumulatedTranscriptRef = useRef("");
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const animFrameRef = useRef<number | null>(null);

  // Keep latest callbacks in ref to prevent stale closures and unnecessary re-creations
  const callbacksRef = useRef({
    onTranscriptChange,
    onResult,
    onError,
    onStart,
    onEnd,
  });

  useEffect(() => {
    callbacksRef.current = {
      onTranscriptChange,
      onResult,
      onError,
      onStart,
      onEnd,
    };
  }, [onTranscriptChange, onResult, onError, onStart, onEnd]);

  // Check browser SpeechRecognition support
  useEffect(() => {
    if (typeof window !== "undefined") {
      const SpeechRecognition =
        (window as any).SpeechRecognition ||
        (window as any).webkitSpeechRecognition;
      setIsSupported(Boolean(SpeechRecognition));
    }
  }, []);

  // Stop listening cleanly and release all microphone resources
  const stopListening = useCallback(() => {
    intentionalStopRef.current = true;
    isListeningRef.current = false;
    setIsListening(false);
    setIsSpeaking(false);
    setAudioLevel(0);
    setInterimTranscript("");

    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }

    // Stop and release microphone tracks
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch {}
      });
      mediaStreamRef.current = null;
      setMediaStream(null);
    }

    // Close AudioContext
    if (audioContextRef.current && audioContextRef.current.state !== "closed") {
      try {
        audioContextRef.current.close().catch(() => {});
      } catch {}
      audioContextRef.current = null;
    }

    // Stop recognition engine
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        try {
          recognitionRef.current.abort();
        } catch {}
      }
    }
  }, []);

  // Start listening session
  const startListening = useCallback(async () => {
    if (typeof window === "undefined") return;

    const SpeechRecognition =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      const msg =
        "Speech recognition is not supported in this browser. Please use Google Chrome or Microsoft Edge.";
      setError(msg);
      callbacksRef.current.onError?.(msg);
      return;
    }

    // Stop existing session if already active
    if (isListeningRef.current) {
      stopListening();
    }

    intentionalStopRef.current = false;
    setError(null);
    accumulatedTranscriptRef.current = "";
    setTranscript("");
    setInterimTranscript("");

    // 1. Explicitly acquire microphone stream to prompt permissions and open hardware audio channel
    let stream: MediaStream | null = null;
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });
        mediaStreamRef.current = stream;
        setMediaStream(stream);

        // Setup Web Audio API Analyser for real-time voice detection & equalizer
        const AudioContextClass =
          window.AudioContext || (window as any).webkitAudioContext;
        if (AudioContextClass) {
          const audioCtx = new AudioContextClass();
          audioContextRef.current = audioCtx;
          const source = audioCtx.createMediaStreamSource(stream);
          const analyser = audioCtx.createAnalyser();
          analyser.fftSize = 64;
          analyser.smoothingTimeConstant = 0.4;
          source.connect(analyser);

          const dataArray = new Uint8Array(analyser.frequencyBinCount);

          const monitorAudio = () => {
            if (!isListeningRef.current) return;

            analyser.getByteFrequencyData(dataArray);

            // Calculate current volume / energy (0.0 to 1.0)
            let sum = 0;
            for (let i = 0; i < dataArray.length; i++) {
              sum += dataArray[i];
            }
            const avg = sum / dataArray.length / 255;
            setAudioLevel(avg);

            // User is speaking when volume exceeds subtle background threshold (0.035)
            const speakingNow = avg > 0.035;
            setIsSpeaking(speakingNow);

            animFrameRef.current = requestAnimationFrame(monitorAudio);
          };

          animFrameRef.current = requestAnimationFrame(monitorAudio);
        }
      } catch (micErr: any) {
        console.warn("Microphone stream request error:", micErr);
        if (
          micErr?.name === "NotAllowedError" ||
          micErr?.name === "PermissionDeniedError"
        ) {
          const msg =
            "Microphone permission was denied. Please allow microphone access in your browser address bar.";
          setError(msg);
          callbacksRef.current.onError?.(msg);
          return;
        }
      }
    }

    // 2. Initialize and configure Web Speech API Recognition
    try {
      const recognition = new SpeechRecognition();

      // Detect language with en-US fallback
      const detectedLang =
        lang ||
        (typeof navigator !== "undefined" && navigator.language
          ? navigator.language
          : "en-US");

      recognition.lang = detectedLang;
      recognition.continuous = continuous;
      recognition.interimResults = interimResults;
      recognition.maxAlternatives = 1;

      recognition.onstart = () => {
        isListeningRef.current = true;
        setIsListening(true);
        setError(null);
        callbacksRef.current.onStart?.();
      };

      recognition.onresult = (event: SpeechRecognitionEvent) => {
        let currentFinal = "";
        let currentInterim = "";

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const res = event.results[i];
          if (res.isFinal) {
            currentFinal += res[0].transcript + " ";
          } else {
            currentInterim += res[0].transcript;
          }
        }

        if (currentFinal) {
          accumulatedTranscriptRef.current += currentFinal;
        }

        const totalSpoken = (
          accumulatedTranscriptRef.current + currentInterim
        ).trim();

        setTranscript(accumulatedTranscriptRef.current.trim());
        setInterimTranscript(currentInterim.trim());

        callbacksRef.current.onTranscriptChange?.(totalSpoken);
        callbacksRef.current.onResult?.(totalSpoken);
      };

      recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
        const err = event.error;

        // "no-speech": Chromium fires this after short pause. We keep listening!
        if (err === "no-speech") {
          return;
        }

        // "aborted": normal stop/reset.
        if (err === "aborted") {
          if (intentionalStopRef.current) {
            isListeningRef.current = false;
            setIsListening(false);
            setIsSpeaking(false);
          }
          return;
        }

        // Fatal errors: handle gracefully
        if (err === "not-allowed" || err === "service-not-allowed") {
          const userFriendly =
            "Microphone access was denied. Please allow microphone permissions in your browser URL bar.";
          setError(userFriendly);
          callbacksRef.current.onError?.(userFriendly);
          stopListening();
          return;
        }

        if (err === "network") {
          // If language was regional and caused timeout, retry with standard en-US
          if (recognition.lang !== "en-US") {
            try {
              recognition.lang = "en-US";
              recognition.start();
              return;
            } catch {}
          }
          const userFriendly =
            "Speech recognition network timeout. Please verify internet connectivity.";
          setError(userFriendly);
          callbacksRef.current.onError?.(userFriendly);
          stopListening();
          return;
        }

        if (err === "audio-capture") {
          const userFriendly =
            "No microphone detected. Please check your hardware or sound settings.";
          setError(userFriendly);
          callbacksRef.current.onError?.(userFriendly);
          stopListening();
          return;
        }
      };

      // Auto-restart on Chromium pause/end if user hasn't explicitly clicked stop
      recognition.onend = () => {
        if (isListeningRef.current && !intentionalStopRef.current) {
          try {
            recognition.start();
            return;
          } catch (restartErr: any) {
            // If already started or browser state pending, proceed
          }
        }
        isListeningRef.current = false;
        setIsListening(false);
        setIsSpeaking(false);
        setInterimTranscript("");
        callbacksRef.current.onEnd?.();
      };

      recognitionRef.current = recognition;
      isListeningRef.current = true;
      setIsListening(true);
      recognition.start();
    } catch (err: any) {
      if (err?.name !== "InvalidStateError") {
        const msg = err?.message || "Could not start microphone dictation.";
        setError(msg);
        callbacksRef.current.onError?.(msg);
      }
      isListeningRef.current = false;
      setIsListening(false);
      setIsSpeaking(false);
    }
  }, [lang, continuous, interimResults, stopListening]);

  const toggleListening = useCallback(() => {
    if (isListeningRef.current) {
      stopListening();
    } else {
      startListening();
    }
  }, [startListening, stopListening]);

  const resetTranscript = useCallback(() => {
    accumulatedTranscriptRef.current = "";
    setTranscript("");
    setInterimTranscript("");
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      intentionalStopRef.current = true;
      isListeningRef.current = false;
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      }
      if (audioContextRef.current && audioContextRef.current.state !== "closed") {
        try {
          audioContextRef.current.close().catch(() => {});
        } catch {}
      }
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {}
      }
    };
  }, []);

  return {
    isListening,
    isSpeaking,
    transcript,
    interimTranscript,
    isSupported,
    error,
    audioLevel,
    mediaStream,
    startListening,
    stopListening,
    toggleListening,
    resetTranscript,
    setTranscript,
  };
}
