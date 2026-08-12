"use client";

import { useEffect, useRef, useState } from "react";
import { Mic, Pause, Play, Square, Trash2 } from "lucide-react";

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
 * Attach a recorded clip to a task through the normal attachment path.
 *
 * Split out because both composers need it after their own create call — the
 * task does not exist while the clip is being recorded, so this cannot be part
 * of the create itself.
 */
export async function uploadVoiceClip(
  taskId: string,
  clip: VoiceClip,
  upload: (formData: FormData) => Promise<{ ok: boolean; error?: string }>
): Promise<{ ok: boolean; error?: string }> {
  const formData = new FormData();
  formData.set("taskId", taskId);
  // Named with the duration so it reads as something in the attachment list
  // rather than an anonymous blob.
  const name = clip.fileName.replace(
    /\.(\w+)$/,
    `-${formatDuration(clip.seconds).replace(":", "m")}s.$1`
  );
  formData.set("file", new File([clip.blob], name, { type: clip.blob.type }));

  return upload(formData);
}

/**
 * In-app voice note capture. Records through MediaRecorder, keeps the clip in
 * memory as a Blob and hands it to the parent — it never uploads anything
 * itself, because a task composer has no task to attach to until it saves.
 *
 * The level meter is driven from an AnalyserNode rather than a fixed animation:
 * a bar that moves whether or not the mic is working is worse than none, since
 * a muted input is the failure this is most likely to hit.
 */
export function VoiceRecorder({
  clip,
  onClip,
  disabled = false,
  compact = false,
}: {
  clip: VoiceClip | null;
  onClip: (clip: VoiceClip | null) => void;
  disabled?: boolean;
  /** Drops the helper line — for tight rows like the detail sheet. */
  compact?: boolean;
}) {
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [level, setLevel] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const frameRef = useRef<number | null>(null);
  const tickRef = useRef<number | null>(null);
  const secondsRef = useRef(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  /** Everything the recording holds open. Safe to call twice. */
  function teardown() {
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    if (tickRef.current !== null) window.clearInterval(tickRef.current);
    frameRef.current = null;
    tickRef.current = null;

    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;

    void audioContextRef.current?.close().catch(() => undefined);
    audioContextRef.current = null;

    setLevel(0);
  }

  // Releasing the microphone is not optional — the browser keeps showing the
  // recording indicator until every track is stopped, including on unmount
  // mid-recording.
  useEffect(() => teardown, []);

  async function start() {
    setError(null);

    if (typeof navigator === "undefined" || !navigator.mediaDevices) {
      setError("This browser can't record audio");
      return;
    }

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (err) {
      // NotAllowedError covers both a denied prompt and a blocked permission,
      // which are the same fix from the user's side.
      const denied =
        err instanceof DOMException &&
        (err.name === "NotAllowedError" || err.name === "SecurityError");
      setError(
        denied
          ? "Microphone access was blocked — allow it in your browser settings"
          : "No microphone available"
      );
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

      onClip({
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
      if (secondsRef.current >= MAX_SECONDS) stop();
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
  }

  function stop() {
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== "inactive") recorder.stop();
    else {
      teardown();
      setRecording(false);
    }
  }

  function discard() {
    if (clip) URL.revokeObjectURL(clip.url);
    audioRef.current?.pause();
    setPlaying(false);
    onClip(null);
    setError(null);
  }

  if (clip) {
    return (
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center gap-2.5 rounded-lg border border-[color-mix(in_oklab,var(--primary)_35%,transparent)] bg-[color-mix(in_oklab,var(--primary)_8%,transparent)] px-3 py-2">
          <button
            type="button"
            onClick={() => {
              const el = audioRef.current;
              if (!el) return;
              if (el.paused) void el.play();
              else el.pause();
            }}
            className="shrink-0 text-[var(--primary)] transition-opacity hover:opacity-80"
            aria-label={playing ? "Pause" : "Play"}
          >
            {playing ? <Pause size={14} /> : <Play size={14} />}
          </button>

          <Mic size={13} className="shrink-0 text-faint" />

          <span className="min-w-0 flex-1 truncate text-[12px]">
            Voice note
          </span>

          <span className="shrink-0 text-[11px] tabular-nums text-faint">
            {formatDuration(clip.seconds)}
          </span>

          <button
            type="button"
            onClick={discard}
            disabled={disabled}
            className="shrink-0 text-faint transition-colors hover:text-destructive disabled:opacity-50"
            aria-label="Discard voice note"
          >
            <Trash2 size={13} />
          </button>
        </div>

        <audio
          ref={audioRef}
          src={clip.url}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onEnded={() => setPlaying(false)}
          className="hidden"
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={recording ? stop : start}
          disabled={disabled}
          data-on={recording}
          className="pill pill-sm disabled:opacity-50"
        >
          {recording ? <Square size={11} /> : <Mic size={11} />}
          {recording ? "Stop" : "Record"}
        </button>

        {recording && (
          <>
            <span className="text-[11px] tabular-nums text-faint">
              {formatDuration(seconds)}
            </span>

            {/* Six bars lit in proportion to the input peak. */}
            <div className="flex items-center gap-0.5" aria-hidden>
              {Array.from({ length: 6 }, (_, i) => (
                <span
                  key={i}
                  className="w-0.5 rounded-full transition-all duration-75"
                  style={{
                    height: `${4 + i * 2}px`,
                    backgroundColor:
                      level * 6 > i
                        ? "var(--primary)"
                        : "color-mix(in oklab, white 15%, transparent)",
                  }}
                />
              ))}
            </div>
          </>
        )}
      </div>

      {error && <p className="text-[11px] text-destructive">{error}</p>}

      {!error && !compact && !recording && (
        <p className="text-[11px] text-faint">
          Attaches a voice note to this task.
        </p>
      )}
    </div>
  );
}
