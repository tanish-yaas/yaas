"use client";

import { useRef, useState, useTransition } from "react";
import {
  Check,
  Copy,
  FileSpreadsheet,
  Loader2,
  Sparkles,
  Upload,
  X,
} from "lucide-react";
import {
  generateDeliverables,
  type DeliverablesResult,
} from "@/server/actions/deliverables";
import { useToast } from "@/components/ui/toast";

const field =
  "w-full rounded-lg border border-border bg-secondary/60 px-3 py-2 text-[13px] outline-none transition-colors focus:border-brand-violet";

export type MonthOption = { value: string; label: string };

/** Month string maths, so no Date object can drag a timezone into a plain day. */
function previousMonth(month: string) {
  const [year, m] = month.split("-").map(Number);
  return m === 1
    ? `${year - 1}-12`
    : `${year}-${String(m - 1).padStart(2, "0")}`;
}

/**
 * The reporting window the form asks for: the 21st of the month before through
 * the 15th, then the 16th to the 20th as the estimate. Picking a month fills
 * all four dates; every one of them stays editable, because the window moves
 * when a deadline does.
 */
function periodsFor(month: string) {
  return {
    workedFrom: `${previousMonth(month)}-21`,
    workedTo: `${month}-15`,
    upcomingFrom: `${month}-16`,
    upcomingTo: `${month}-20`,
  };
}

function Answer({
  question,
  body,
}: {
  question: string;
  body: string;
}) {
  const [copied, setCopied] = useState(false);
  const { push } = useToast();

  async function copy() {
    try {
      await navigator.clipboard.writeText(body);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      push("Couldn't copy — select the text and copy it by hand", "error");
    }
  }

  return (
    <section className="panel overflow-hidden">
      <div className="flex items-start justify-between gap-3 border-b border-[color-mix(in_oklab,white_7%,transparent)] px-4 py-2.5">
        <h2 className="text-[11px] uppercase tracking-[0.12em] text-faint">
          {question}
        </h2>
        <button
          type="button"
          onClick={copy}
          className="pill pill-sm shrink-0"
        >
          {copied ? <Check size={12} /> : <Copy size={12} />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      {/* Pre, not a paragraph: this is going into a form exactly as it reads,
          line breaks and all. */}
      <pre className="overflow-x-auto px-4 py-4 font-sans text-[13px] leading-relaxed whitespace-pre-wrap">
        {body}
      </pre>
    </section>
  );
}

export function DeliverablesPanel({
  months,
  defaultMonth,
}: {
  months: MonthOption[];
  defaultMonth: string;
}) {
  const [month, setMonth] = useState(defaultMonth);
  const [dates, setDates] = useState(() => periodsFor(defaultMonth));
  const [files, setFiles] = useState<File[]>([]);
  const [result, setResult] = useState<DeliverablesResult | null>(null);
  const [dragging, setDragging] = useState(false);
  const [pending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);
  const { push } = useToast();

  function pickMonth(next: string) {
    setMonth(next);
    setDates(periodsFor(next));
  }

  function addFiles(incoming: FileList | null) {
    if (!incoming) return;
    const next = [...incoming];
    setFiles((prev) => {
      const seen = new Set(prev.map((f) => `${f.name}:${f.size}`));
      return [...prev, ...next.filter((f) => !seen.has(`${f.name}:${f.size}`))];
    });
  }

  function run() {
    if (files.length === 0) {
      push("Add the sheets first", "error");
      return;
    }

    startTransition(async () => {
      const formData = new FormData();
      for (const file of files) formData.append("files", file);
      for (const [key, value] of Object.entries(dates)) {
        formData.set(key, value);
      }

      const outcome = await generateDeliverables(formData);
      setResult(outcome);
      if (!outcome.ok) push(outcome.error, "error");
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <section className="panel overflow-hidden">
        <div className="border-b border-[color-mix(in_oklab,white_7%,transparent)] px-4 py-2.5">
          <h2 className="text-[11px] uppercase tracking-[0.12em] text-faint">
            Period
          </h2>
        </div>

        <div className="flex flex-col gap-4 px-4 py-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-[11px] text-faint">Reporting month</span>
            <select
              value={month}
              onChange={(e) => pickMonth(e.target.value)}
              className={`${field} max-w-[220px]`}
            >
              {months.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="mb-1.5 text-[11px] text-faint">Worked on</p>
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={dates.workedFrom}
                  onChange={(e) =>
                    setDates((d) => ({ ...d, workedFrom: e.target.value }))
                  }
                  className={field}
                />
                <span className="shrink-0 text-[12px] text-faint">to</span>
                <input
                  type="date"
                  value={dates.workedTo}
                  onChange={(e) =>
                    setDates((d) => ({ ...d, workedTo: e.target.value }))
                  }
                  className={field}
                />
              </div>
            </div>

            <div>
              <p className="mb-1.5 text-[11px] text-faint">
                Will work on (estimate)
              </p>
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={dates.upcomingFrom}
                  onChange={(e) =>
                    setDates((d) => ({ ...d, upcomingFrom: e.target.value }))
                  }
                  className={field}
                />
                <span className="shrink-0 text-[12px] text-faint">to</span>
                <input
                  type="date"
                  value={dates.upcomingTo}
                  onChange={(e) =>
                    setDates((d) => ({ ...d, upcomingTo: e.target.value }))
                  }
                  className={field}
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="panel overflow-hidden">
        <div className="border-b border-[color-mix(in_oklab,white_7%,transparent)] px-4 py-2.5">
          <h2 className="text-[11px] uppercase tracking-[0.12em] text-faint">
            Tracking sheets
          </h2>
        </div>

        <div className="px-4 py-4">
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              addFiles(e.dataTransfer.files);
            }}
            onClick={() => inputRef.current?.click()}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                inputRef.current?.click();
              }
            }}
            className={`flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed px-4 py-8 text-center transition-colors ${
              dragging
                ? "border-brand-violet bg-[color-mix(in_oklab,var(--primary)_10%,transparent)]"
                : "border-border hover:border-[var(--border-strong)]"
            }`}
          >
            <Upload size={16} className="text-faint" />
            <p className="text-[13px]">Drop the sheets here, or click to pick</p>
            <p className="text-[11px] text-faint">
              Excel workbooks (every tab is an IP) or CSVs (one per IP)
            </p>
            <input
              ref={inputRef}
              type="file"
              multiple
              accept=".csv,.tsv,.txt,.xlsx,.xlsm"
              onChange={(e) => {
                addFiles(e.target.files);
                e.target.value = "";
              }}
              className="hidden"
            />
          </div>

          {files.length > 0 && (
            <ul className="mt-3 flex flex-col gap-1.5">
              {files.map((file) => (
                <li
                  key={`${file.name}:${file.size}`}
                  className="flex items-center gap-2.5 rounded-lg border border-border bg-secondary/40 px-3 py-2"
                >
                  <FileSpreadsheet size={13} className="shrink-0 text-faint" />
                  <span className="min-w-0 flex-1 truncate text-[12px]">
                    {file.name}
                  </span>
                  <span className="shrink-0 text-[11px] tabular-nums text-faint">
                    {(file.size / 1024).toFixed(0)} KB
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setFiles((prev) => prev.filter((f) => f !== file))
                    }
                    className="shrink-0 rounded p-1 text-faint transition-colors hover:text-foreground"
                  >
                    <X size={12} />
                  </button>
                </li>
              ))}
            </ul>
          )}

          <button
            type="button"
            onClick={run}
            disabled={pending}
            className="mt-4 inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-4 text-[12px] font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {pending ? (
              <>
                <Loader2 size={13} className="animate-spin" />
                Reading the sheets…
              </>
            ) : (
              <>
                <Sparkles size={13} />
                Write both answers
              </>
            )}
          </button>
        </div>
      </section>

      {result?.ok && (
        <>
          <div className="flex flex-wrap items-center gap-2">
            {[
              `${result.report.counts.total} deliverables`,
              `${result.report.counts.longForm} LF`,
              `${result.report.counts.shortForm} SF`,
              `${result.report.counts.live} live`,
              `${result.report.counts.wip} WIP`,
              `${result.report.counts.ips} IPs`,
            ].map((chip) => (
              <span
                key={chip}
                className="chip border-[color-mix(in_oklab,white_10%,transparent)] bg-[color-mix(in_oklab,white_5%,transparent)] text-faint"
              >
                {chip}
              </span>
            ))}
          </div>

          <Answer
            question="Deliverables worked on in this period"
            body={result.report.answerOne}
          />
          <Answer
            question="Deliverables planned for the next period"
            body={result.report.answerTwo}
          />

          {(result.notes.length > 0 || result.truncated) && (
            <section className="panel overflow-hidden">
              <div className="border-b border-[color-mix(in_oklab,white_7%,transparent)] px-4 py-2.5">
                <h2 className="text-[11px] uppercase tracking-[0.12em] text-faint">
                  Worth checking
                </h2>
              </div>
              <ul className="flex list-disc flex-col gap-1.5 px-8 py-4 text-[12px] leading-relaxed text-muted-foreground">
                {result.truncated && (
                  <li>
                    The upload was long enough that the end was cut off. Split
                    it, or narrow the sheets to this period.
                  </li>
                )}
                {result.notes.map((note, i) => (
                  <li key={i}>{note}</li>
                ))}
              </ul>
            </section>
          )}

          <p className="px-1 text-[11px] leading-relaxed text-faint">
            Read from {result.sources.length}{" "}
            {result.sources.length === 1 ? "sheet" : "sheets"}:{" "}
            {result.sources.join(", ")}. Check the lines against the sheet
            before sending — this is a model reading a spreadsheet.
          </p>
        </>
      )}
    </div>
  );
}
