"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/** Recording stops itself here. Ten minutes of Opus sits well inside the 10 MB
    attachment cap, and an accidental open mic shouldn't run all afternoon. */
const MAX_SECONDS = 10 * 60;

/**
 * Ordered by preference. Chrome and Firefox take the first; Safari has no
 * WebM encoder and falls through to mp4. An empty type lets the browser pick,
 * which is better than refusing to record at all.
 */
const CANDIDATE_TYPES = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/mp4",
  "audio/ogg;codecs=opus",
];

function pickMimeType(): string {
  if (typeof MediaRecorder === "undefined") return "";
  return CANDIDATE_TYPES.find((t) => MediaRecorder.isTypeSupported(t)) ?? "";
}

function extensionFor(mimeType: string): string {
  if (mimeType.includes("mp4")) return "m4a";
  if (mimeType.includes("ogg")) return "ogg";
  return "webm";
}

export function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

export type VoiceClip = {
  blob: Blob;
  /** Object URL for preview playback. Revoked when the clip is dropped. */
  url: string;
  seconds: number;
  fileName: string;
};

/**
 * Turn a getUserMedia rejection into something a user can act on.
 *
 * These all arrive as NotAllowedError and mean different things, so the copy
 * has to come from context rather than the error alone. The case that cost the
 * most to diagnose was a Permissions-Policy header of `microphone=()`: the
 * browser refuses without ever prompting, which is indistinguishable from a
 * denied permission except that no site setting can fix it. See next.config.ts.
 */
function describeMicError(err: unknown, alreadyDenied: boolean): string {
  const name = err instanceof DOMException ? err.name : "";

  if (name === "NotFoundError" || name === "OverconstrainedError") {
    return "No microphone found — plug one in and try again";
  }

  // The device exists but something else holds it, or the OS refuses. On
  // Windows this is also what a disabled system-wide mic permission looks like.
  if (name === "NotReadableError" || name === "AbortError") {
    return "Your microphone is busy in another app — close it and try again";
  }

  if (name === "NotAllowedError" || name === "SecurityError") {
    return alreadyDenied
      ? "Microphone blocked. Click the icon at the left of the address bar → Microphone → Allow, then reload."
      : "Nova couldn't reach your microphone. Check that your browser and Windows both allow it, then try again.";
  }

  return "Couldn't start recording";
}

/**
 * The microphone half of every recording surface: permissions, codec choice,
 * the elapsed timer, the input level, and releasing the device afterwards.
 *
 * A hook rather than a component because two very different UIs sit on top of
 * it — the voice-note field, which keeps the clip, and the dictation button,
 * which throws the audio away once it has the transcript. Sharing the engine
 * means the permission handling above has one home; it has already been wrong
 * once, and fixing that twice is how the two copies drift.
 */
export function useAudioRecorder({
  onClip,
  maxSeconds = MAX_SECONDS,
}: {
  /** Fires once, when a recording stops with audio in it. */
  onClip: (clip: VoiceClip) => void;
  maxSeconds?: number;
}) {
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [level, setLevel] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const frameRef = useRef<number | null>(null);
  const tickRef = useRef<number | null>(null);
  const secondsRef = useRef(0);

  // Held in a ref so the recorder's onstop closure always calls the current
  // one without having to re-create the recorder when the parent re-renders.
  const onClipRef = useRef(onClip);
  useEffect(() => {
    onClipRef.current = onClip;
  }, [onClip]);

  /** Everything the recording holds open. Safe to call twice. */
  const teardown = useCallback(() => {
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    if (tickRef.current !== null) window.clearInterval(tickRef.current);
    frameRef.current = null;
    tickRef.current = null;

    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;

    void audioContextRef.current?.close().catch(() => undefined);
    audioContextRef.current = null;

    setLevel(0);
  }, []);

  // Releasing the microphone is not optional — the browser keeps showing the
  // recording indicator until every track is stopped, including on unmount
  // mid-recording.
  useEffect(() => teardown, [teardown]);

  const stop = useCallback(() => {
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      recorder.stop();
      return;
    }
    teardown();
    setRecording(false);
  }, [teardown]);

  const start = useCallback(async () => {
    setError(null);

    // getUserMedia only exists on a secure origin. Over plain http on a LAN
    // address — which is what `next dev` prints as its Network URL — it is
    // either missing or rejects, and no amount of clicking Allow will help.
    // Worth naming, because the browser gives no clue that this is the reason.
    if (typeof window !== "undefined" && !window.isSecureContext) {
      setError("Recording needs https — open Nova on localhost or the live site");
      return;
    }

    if (typeof navigator === "undefined" || !navigator.mediaDevices) {
      setError("This browser can't record audio");
      return;
    }

    // Asked before prompting, purely to tell two states apart that throw the
    // same error: "will ask you now" and "already refused, and will not ask
    // again". Only the second needs the user to go into site settings.
    let alreadyDenied = false;
    try {
      const status = await navigator.permissions?.query({
        name: "microphone" as PermissionName,
      });
      alreadyDenied = status?.state === "denied";
    } catch {
      // Firefox has no microphone descriptor here. Fall through and let
      // getUserMedia be the authority.
    }

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (err) {
      setError(describeMicError(err, alreadyDenied));
      return;
    }

    streamRef.current = stream;

    const mimeType = pickMimeType();
    let recorder: MediaRecorder;
    try {
      recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    } catch {
      teardown();
      setError("This browser can't record audio");
      return;
    }

    chunksRef.current = [];
    recorderRef.current = recorder;

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };

    recorder.onstop = () => {
      // recorder.mimeType is the type actually used, which may differ from the
      // one requested. The blob has to match or playback breaks.
      const type = recorder.mimeType || mimeType || "audio/webm";
      const blob = new Blob(chunksRef.current, { type });
      chunksRef.current = [];
      teardown();
      setRecording(false);

      if (blob.size === 0) {
        setError("Nothing was recorded");
        return;
      }

      onClipRef.current({
        blob,
        url: URL.createObjectURL(blob),
        seconds: secondsRef.current,
        fileName: `voice-note.${extensionFor(type)}`,
      });
    };

    // Timeslice so a long recording flushes as it goes rather than sitting in
    // one buffer until stop.
    recorder.start(1000);
    setRecording(true);
    secondsRef.current = 0;
    setSeconds(0);

    tickRef.current = window.setInterval(() => {
      secondsRef.current += 1;
      setSeconds(secondsRef.current);
      if (secondsRef.current >= maxSeconds) stop();
    }, 1000);

    // Level meter. Wrapped because Safari has thrown here when the page is
    // backgrounded at exactly the wrong moment, and a dead meter should not
    // take the recording with it.
    try {
      const context = new AudioContext();
      audioContextRef.current = context;
      const source = context.createMediaStreamSource(stream);
      const analyser = context.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);

      const data = new Uint8Array(analyser.frequencyBinCount);
      const sample = () => {
        analyser.getByteTimeDomainData(data);
        let peak = 0;
        for (const v of data) peak = Math.max(peak, Math.abs(v - 128) / 128);
        setLevel(peak);
        frameRef.current = requestAnimationFrame(sample);
      };
      sample();
    } catch {
      // No meter; the timer still tells you it is running.
    }
  }, [maxSeconds, stop, teardown]);

  return { recording, seconds, level, error, setError, start, stop };
}
