"use client";

import { useState, useTransition } from "react";
import { MessageCircle, Copy, Check, Info } from "lucide-react";
import { generateLinkCode, unlinkWhatsApp } from "@/server/actions/whatsapp";

export function WhatsAppLink({
  linkedNumber,
  businessNumber,
  sandboxMode,
}: {
  linkedNumber: string | null;
  businessNumber: string;
  sandboxMode: boolean;
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

  const sandboxNotice = sandboxMode && (
    <div className="mt-4 flex items-start gap-2 rounded-lg border border-[#F5B544]/30 bg-[#F5B544]/10 px-3 py-2.5">
      <Info size={13} className="mt-0.5 shrink-0 text-[#F5B544]" />
      <p className="text-[11px] leading-relaxed text-muted-foreground">
        WhatsApp is in test mode. Only numbers an admin has added in Meta can
        send or receive messages. Ask your admin before linking.
      </p>
    </div>
  );

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
        {sandboxNotice}
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

      {sandboxNotice}

      {!code ? (
        <button
          type="button"
          onClick={generate}
          disabled={pending}
          className="mt-4 rounded-lg bg-primary px-4 py-2 text-xs font-medium text-primary-foreground transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-50"
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