import { useEffect, useRef, useState } from 'react';

interface AudioLevelResult {
  /** Smoothed RMS amplitude, 0.0–1.0 */
  level: number;
  /** True when the person is audibly speaking (level above threshold for several frames) */
  isSpeaking: boolean;
}

const SPEAKING_THRESHOLD = 0.015;
// Frames above threshold before we flip isSpeaking → true (avoids false triggers)
const ONSET_FRAMES = 3;
// Frames below threshold before we flip isSpeaking → false (avoids flicker on pauses)
const RELEASE_FRAMES = 12;

/**
 * Analyses the audio content of a MediaStream in real time using the Web Audio
 * API. Returns a smoothed RMS level (0–1) and a debounced isSpeaking boolean.
 *
 * Works for both local (getUserMedia) and remote (WebRTC ontrack) streams.
 * The AudioContext is created lazily and cleaned up when the stream changes or
 * the consuming component unmounts.
 */
export function useAudioLevel(stream: MediaStream | null): AudioLevelResult {
  const [level, setLevel] = useState(0);
  const [isSpeaking, setIsSpeaking] = useState(false);

  const rafRef = useRef<number | null>(null);
  const onsetCountRef = useRef(0);
  const releaseCountRef = useRef(0);
  const isSpeakingRef = useRef(false);
  const smoothedLevelRef = useRef(0);

  useEffect(() => {
    if (!stream) {
      setLevel(0);
      setIsSpeaking(false);
      return;
    }

    const audioTracks = stream.getAudioTracks();
    if (audioTracks.length === 0) return;

    let ctx: AudioContext;
    let source: MediaStreamAudioSourceNode;
    let analyser: AnalyserNode;
    let cancelled = false;

    try {
      ctx = new AudioContext();
      source = ctx.createMediaStreamSource(stream);
      analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.4;
      source.connect(analyser);
    } catch {
      return;
    }

    // Resume context if browser suspended it (autoplay policy)
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    const buf = new Uint8Array(analyser.fftSize);

    function tick() {
      if (cancelled) return;

      analyser.getByteTimeDomainData(buf);

      // RMS of the waveform (128 = silence in 0–255 unsigned format)
      let sumSq = 0;
      for (let i = 0; i < buf.length; i++) {
        const s = (buf[i] - 128) / 128;
        sumSq += s * s;
      }
      const rms = Math.sqrt(sumSq / buf.length);

      // Exponential moving average for smooth visual
      smoothedLevelRef.current = smoothedLevelRef.current * 0.75 + rms * 0.25;
      setLevel(smoothedLevelRef.current);

      // Debounced speaking detection
      if (smoothedLevelRef.current > SPEAKING_THRESHOLD) {
        onsetCountRef.current++;
        releaseCountRef.current = 0;
        if (!isSpeakingRef.current && onsetCountRef.current >= ONSET_FRAMES) {
          isSpeakingRef.current = true;
          setIsSpeaking(true);
        }
      } else {
        releaseCountRef.current++;
        onsetCountRef.current = 0;
        if (isSpeakingRef.current && releaseCountRef.current >= RELEASE_FRAMES) {
          isSpeakingRef.current = false;
          setIsSpeaking(false);
        }
      }

      rafRef.current = requestAnimationFrame(tick);
    }

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      cancelled = true;
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      try { source.disconnect(); } catch { /* noop */ }
      ctx.close().catch(() => {});
      onsetCountRef.current = 0;
      releaseCountRef.current = 0;
      isSpeakingRef.current = false;
      smoothedLevelRef.current = 0;
      setLevel(0);
      setIsSpeaking(false);
    };
  }, [stream]);

  return { level, isSpeaking };
}
