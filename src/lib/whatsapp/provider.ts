export type OutboundMessage = {
  to: string;
  body: string;
};

export type SendResult =
  | { ok: true; providerMessageId: string }
  | { ok: false; error: string };

export interface WhatsAppProvider {
  sendText(message: OutboundMessage): Promise<SendResult>;
}

const GRAPH_VERSION = "v21.0";

class MetaCloudProvider implements WhatsAppProvider {
  async sendText({ to, body }: OutboundMessage): Promise<SendResult> {
    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
    const token = process.env.WHATSAPP_ACCESS_TOKEN;

    if (!phoneNumberId || !token) {
      return { ok: false, error: "WhatsApp is not configured" };
    }

    try {
      const response = await fetch(
        `https://graph.facebook.com/${GRAPH_VERSION}/${phoneNumberId}/messages`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            messaging_product: "whatsapp",
            recipient_type: "individual",
            to: to.replace(/^\+/, ""),
            type: "text",
            text: { preview_url: false, body },
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        const detail = data?.error?.message ?? `HTTP ${response.status}`;
        return { ok: false, error: detail };
      }

      return {
        ok: true,
        providerMessageId: data?.messages?.[0]?.id ?? "unknown",
      };
    } catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : "Network error",
      };
    }
  }
}

class ConsoleProvider implements WhatsAppProvider {
  async sendText({ to, body }: OutboundMessage): Promise<SendResult> {
    console.log(`[whatsapp:console] → ${to}\n${body}\n`);
    return { ok: true, providerMessageId: `console-${Date.now()}` };
  }
}

export function getWhatsAppProvider(): WhatsAppProvider {
  if (process.env.WHATSAPP_PHONE_NUMBER_ID && process.env.WHATSAPP_ACCESS_TOKEN) {
    return new MetaCloudProvider();
  }
  return new ConsoleProvider();
}