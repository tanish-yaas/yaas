"use client";

import { useState, useTransition } from "react";
import { MessageCircle, Copy, Check, Info } from "lucide-react";
import { generateLinkCode, unlinkWhatsApp } from "@/server/actions/whatsapp";
import { SettingsPanel } from "./settings-panel";

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
    <div className="mt-4 flex items-start gap-2 rounded-xl border border-[color-mix(in_oklab,var(--status-amber)_35%,transparent)] bg-[color-mix(in_oklab,var(--status-amber)_10%,transparent)] px-3 py-2.5">
      <Info
        size={13}
        className="mt-0.5 shrink-0"
        style={{ color: "var(--status-amber)" }}
      />
      <p className="text-[12px] leading-relaxed text-muted-foreground">
        WhatsApp is in test mode. Only numbers an admin has added in Meta can
        send or receive messages. Ask your admin before linking.
      </p>
    </div>
  );

  if (linkedNumber) {
    return (
      <SettingsPanel
        title="WhatsApp connected"
        icon={
          <MessageCircle size={12} style={{ color: "var(--status-green)" }} />
        }
      >
        <p className="text-[13px] text-muted-foreground">
          {linkedNumber} · send a message any time to create a task
        </p>
        {sandboxNotice}
        <button
          type="button"
          onClick={unlink}
          disabled={pending}
          className="pill pill-sm mt-4 disabled:opacity-50"
        >
          Unlink
        </button>
      </SettingsPanel>
    );
  }

  return (
    <SettingsPanel
      title="Connect WhatsApp"
      icon={<MessageCircle size={12} style={{ color: "var(--primary)" }} />}
      description="Capture tasks by texting them. Generate a code, send it to the YAAS number, and you're linked."
    >
      {sandboxNotice}

      {!code ? (
        <button
          type="button"
          onClick={generate}
          disabled={pending}
          className="mt-4 inline-flex h-8 items-center rounded-full bg-primary px-3.5 text-[12px] font-medium text-primary-foreground transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-50"
        >
          {pending ? "Generating…" : "Get link code"}
        </button>
      ) : (
        <div className="mt-4 flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <code className="flex-1 rounded-xl border border-[color-mix(in_oklab,var(--primary)_40%,transparent)] bg-[color-mix(in_oklab,var(--primary)_10%,transparent)] px-3 py-2.5 text-center font-mono text-[13px] tracking-wider">
              {code}
            </code>
            <button type="button" onClick={copy} className="icon-btn">
              {copied ? <Check size={14} /> : <Copy size={14} />}
            </button>
          </div>
          <p className="text-[12px] text-faint">
            Send this to{" "}
            <span className="text-foreground">{businessNumber}</span> on
            WhatsApp within 15 minutes, then refresh this page.
          </p>
        </div>
      )}
    </SettingsPanel>
  );
}