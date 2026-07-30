"use client";

import { useState, useTransition } from "react";
import { MessageCircle, Copy, Check } from "lucide-react";
import { generateLinkCode, unlinkWhatsApp } from "@/server/actions/whatsapp";

export function WhatsAppLink({
  linkedNumber,
  businessNumber,
}: {
  linkedNumber: string | null;
  businessNumber: string;
}) {
  const [code, setCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [pending, startTransition] = useTransition();

  function generate() {
    startTransition(async () => {
      const result = await generateLinkCode();
      if (result.ok) setCode(result.code);
    });
  }

  function unlink() {
    if (!confirm("Unlink WhatsApp from your account?")) return;
    startTransition(async () => {
      await unlinkWhatsApp();
      setCode(null);
    });
  }

  async function copy() {
    if (!code) return;
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  if (linkedNumber) {
    return (
      <div className="glass rounded-xl px-5 py-5">
        <div className="flex items-center gap-2.5">
          <MessageCircle size={15} className="text-[#4ADE80]" />
          <h2 className="text-sm">WhatsApp connected</h2>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          {linkedNumber} · send a message any time to create a task
        </p>
        <button
          type="button"
          onClick={unlink}
          disabled={pending}
          className="mt-4 text-xs text-muted-foreground underline underline-offset-4 transition-colors hover:text-destructive"
        >
          Unlink
        </button>
      </div>
    );
  }

  return (
    <div className="glass rounded-xl px-5 py-5">
      <div className="flex items-center gap-2.5">
        <MessageCircle size={15} className="text-brand-violet" />
        <h2 className="text-sm">Connect WhatsApp</h2>
      </div>
      <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
        Capture tasks by texting them. Generate a code, send it to the YAAS
        number, and you&apos;re linked.
      </p>

      {!code ? (
        <button
          type="button"
          onClick={generate}
          disabled={pending}
          className="mt-4 rounded-lg bg-primary px-4 py-2 text-xs font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {pending ? "Generating…" : "Get link code"}
        </button>
      ) : (
        <div className="mt-4 flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <code className="flex-1 rounded-lg border border-brand-violet/40 bg-brand-violet/10 px-3 py-2.5 text-center font-mono text-sm tracking-wider">
              {code}
            </code>
            <button
              type="button"
              onClick={copy}
              className="rounded-lg border border-border p-2.5 text-muted-foreground transition-colors hover:text-foreground"
            >
              {copied ? <Check size={14} /> : <Copy size={14} />}
            </button>
          </div>
          <p className="text-xs text-muted-foreground">
            Send this to{" "}
            <span className="text-foreground">{businessNumber}</span> on
            WhatsApp within 15 minutes, then refresh this page.
          </p>
        </div>
      )}
    </div>
  );
}