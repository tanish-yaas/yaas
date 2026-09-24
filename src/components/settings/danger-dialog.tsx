"use client";

import { useEffect, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, ArrowLeft, Loader2 } from "lucide-react";
import { useToast } from "@/components/ui/toast";

export const DANGER = "var(--status-red)";

export type Confirmation = {
  /** Form field name the action reads. */
  name: string;
  /** "Enter the workspace name X to continue:" — X is `expected`. */
  label: React.ReactNode;
  expected: string;
  /** Phrases are matched loosely; names and emails exactly. */
  ignoreCase?: boolean;
};

const field =
  "mt-1.5 w-full rounded-lg border border-border bg-secondary/60 px-3 py-2 text-[13px] outline-none transition-colors focus:border-[var(--status-red)]";

function matches(value: string, confirmation: Confirmation) {
  const typed = value.trim();
  const expected = confirmation.expected.trim();
  return confirmation.ignoreCase
    ? typed.toLowerCase() === expected.toLowerCase()
    : typed === expected;
}

/**
 * The confirmation both deletions run through: first what will happen, then
 * typing it out. Two steps because one is too few for something this final —
 * the first is there to be read, the second to be slow. It is the shape
 * GitHub and Vercel use, for the same reason.
 *
 * Nothing here is a security control. The action re-checks every word typed;
 * this only makes sure the person meant this workspace, this account, today.
 */
export function DangerDialog({
  title,
  intro,
  consequences,
  confirmations,
  submitLabel,
  pendingLabel,
  action,
  onClose,
}: {
  title: string;
  intro: React.ReactNode;
  /** The bullet list on step one. */
  consequences: React.ReactNode[];
  confirmations: Confirmation[];
  submitLabel: string;
  pendingLabel: string;
  /** Returns nothing when it succeeds — success navigates away. */
  action: (formData: FormData) => Promise<{ ok: false; error: string } | void>;
  onClose: () => void;
}) {
  const [step, setStep] = useState<1 | 2>(1);
  const [values, setValues] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();
  const { push } = useToast();

  const ready = confirmations.every((c) => matches(values[c.name] ?? "", c));

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape" && !pending) onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose, pending]);

  function submit(formData: FormData) {
    if (!ready) return;
    startTransition(async () => {
      const result = await action(formData);
      if (result && !result.ok) push(result.error, "error");
    });
  }

  return createPortal(
    <>
      <div
        className="fixed inset-0 z-[9998] bg-black/60"
        onClick={() => !pending && onClose()}
        aria-hidden
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="overlay fixed left-1/2 top-[calc(0.12*var(--vh))] z-[9999] max-h-[calc(0.84*var(--vh))] w-[min(30rem,calc(100vw-2rem))] -translate-x-1/2 overflow-y-auto"
      >
        <form action={submit}>
          <div className="px-5 pt-5">
            <p className="text-[10px] uppercase tracking-[0.18em] text-faint">
              Step {step} of 2
            </p>
            <h2 className="mt-1 text-[16px] font-semibold tracking-tight">
              {title}
            </h2>
            <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">
              {intro}
            </p>
          </div>

          {step === 1 ? (
            <>
              <div
                className="mx-5 mt-4 rounded-lg border px-3.5 py-3"
                style={{
                  borderColor: `color-mix(in oklab, ${DANGER} 40%, transparent)`,
                  backgroundColor: `color-mix(in oklab, ${DANGER} 9%, transparent)`,
                }}
              >
                <p
                  className="flex items-center gap-1.5 text-[12px] font-medium"
                  style={{ color: `color-mix(in oklab, ${DANGER} 70%, white)` }}
                >
                  <AlertTriangle size={13} className="shrink-0" />
                  This cannot be undone. Please be certain.
                </p>
                <ul className="mt-2 flex list-disc flex-col gap-1.5 pl-5 text-[12px] leading-relaxed text-muted-foreground">
                  {consequences.map((line, i) => (
                    <li key={i}>{line}</li>
                  ))}
                </ul>
              </div>

              <div className="mt-5 flex items-center justify-end gap-2 border-t border-border bg-secondary/30 px-5 py-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="pill pill-sm"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="inline-flex h-8 items-center rounded-lg border px-3.5 text-[12px] font-medium transition-colors hover:bg-[color-mix(in_oklab,var(--status-red)_14%,transparent)]"
                  style={{
                    borderColor: `color-mix(in oklab, ${DANGER} 55%, transparent)`,
                    color: `color-mix(in oklab, ${DANGER} 80%, white)`,
                  }}
                >
                  I understand, continue
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="flex flex-col gap-4 px-5 py-5">
                {confirmations.map((confirmation, i) => (
                  <label key={confirmation.name} className="block">
                    <span className="text-[12px] leading-relaxed text-muted-foreground">
                      {confirmation.label}
                    </span>
                    <input
                      name={confirmation.name}
                      value={values[confirmation.name] ?? ""}
                      onChange={(e) =>
                        setValues((prev) => ({
                          ...prev,
                          [confirmation.name]: e.target.value,
                        }))
                      }
                      autoFocus={i === 0}
                      autoComplete="off"
                      autoCapitalize="none"
                      spellCheck={false}
                      disabled={pending}
                      className={field}
                    />
                  </label>
                ))}
              </div>

              <div className="flex items-center justify-end gap-2 border-t border-border bg-secondary/30 px-5 py-3">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  disabled={pending}
                  className="pill pill-sm mr-auto disabled:opacity-50"
                >
                  <ArrowLeft size={12} />
                  Back
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  disabled={pending}
                  className="pill pill-sm disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!ready || pending}
                  className="inline-flex h-8 items-center gap-1.5 rounded-lg px-3.5 text-[12px] font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-35"
                  style={{ backgroundColor: DANGER }}
                >
                  {pending ? (
                    <>
                      <Loader2 size={12} className="animate-spin" />
                      {pendingLabel}
                    </>
                  ) : (
                    submitLabel
                  )}
                </button>
              </div>
            </>
          )}
        </form>
      </div>
    </>,
    document.body
  );
}
