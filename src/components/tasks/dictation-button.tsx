"use client";

import { Loader2, Mic, Square } from "lucide-react";
import { useAudioRecorder, formatDuration, type VoiceClip } from "./use-audio-recorder";
import { LevelMeter } from "./voice-recorder";

/** A dictated task is a sentence or two. Past this it is a voice note, not a
    title, and the parser has a 2000-character ceiling anyway. */
const MAX_SECONDS = 90;

/**
 * Speak a task instead of typing it. Sits beside Add in the composer: press to
 * record, press again to stop, and the clip goes off to be transcribed and
 * parsed.
 *
 * Deliberately not the same control as the voice-note field. That one keeps
 * the audio and attaches it to the task; this one only wants the words and
 * throws the recording away. Same engine underneath, different intent.
 */
export function DictationButton({
  onClip,
  busy = false,
  disabled = false,
}: {
  onClip: (clip: VoiceClip) => void;
  /** The parent is transcribing the clip this button just handed over. */
  busy?: boolean;
  disabled?: boolean;
}) {
  const { recording, seconds, level, error, start, stop } = useAudioRecorder({
    onClip,
    maxSeconds: MAX_SECONDS,
  });

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-2">
        {recording && (
          <>
            <LevelMeter level={level} />
            <span className="text-[11px] tabular-nums text-faint">
              {formatDuration(seconds)}
            </span>
          </>
        )}

        <button
          type="button"
          onClick={recording ? stop : start}
          disabled={disabled || busy}
          data-on={recording}
          title={
            recording ? "Stop and turn this into a task" : "Speak a task instead"
          }
          aria-label={recording ? "Stop recording" : "Speak a task"}
          className="pill pill-sm shrink-0 disabled:opacity-50"
        >
          {busy ? (
            <Loader2 size={11} className="animate-spin" />
          ) : recording ? (
            <Square size={11} />
          ) : (
            <Mic size={11} />
          )}
          {busy ? "Reading…" : recording ? "Stop" : "Speak"}
        </button>
      </div>

      {error && (
        <p className="max-w-[18rem] text-right text-[11px] text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
