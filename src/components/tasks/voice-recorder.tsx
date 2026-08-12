"use client";

import { useRef, useState } from "react";
import { Mic, Pause, Play, Square, Trash2 } from "lucide-react";
import {
  formatDuration,
  useAudioRecorder,
  type VoiceClip,
} from "./use-audio-recorder";

export { formatDuration, type VoiceClip };

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

/** Six bars lit in proportion to the input peak. */
export function LevelMeter({ level }: { level: number }) {
  return (
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
  );
}

/**
 * Voice note capture. Keeps the clip in memory as a Blob and hands it to the
 * parent — it never uploads anything itself, because a task composer has no
 * task to attach to until it saves.
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
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const { recording, seconds, level, error, setError, start, stop } =
    useAudioRecorder({ onClip });

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

          <span className="min-w-0 flex-1 truncate text-[12px]">Voice note</span>

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
            <LevelMeter level={level} />
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
