import { generateText } from "ai";
import { google } from "@ai-sdk/google";
import { AI_CONFIG } from "@/config/ai";

export type TranscribeResult =
  | { ok: true; text: string }
  | { ok: false; error: string };

/**
 * Dictation, not summarisation. The model's job here is to write down what was
 * said and nothing else — the task parser runs on the output afterwards and is
 * the thing allowed to interpret. A model that helpfully tidies "um, tell Priya
 * about the deck" into a polished sentence loses the phrasing the parser keys
 * off, so the prompt is blunt about it.
 */
const SYSTEM = `You transcribe short spoken notes about work tasks.

Write out exactly what the speaker said, as plain text.

- Do not summarise, rephrase, translate, or tidy up the wording.
- Do not add commentary, headings, quotes, or labels.
- Drop filler sounds ("um", "uh") and false starts.
- Keep names, dates, times and numbers exactly as spoken.
- Indian English, Hindi and Hinglish are all expected. Transcribe Hindi words
  in Roman script, the way they were said.
- If the audio contains no intelligible speech, reply with exactly: NO_SPEECH`;

async function callModel(
  bytes: Uint8Array,
  mediaType: string,
  attempt = 1
): Promise<string> {
  try {
    const result = await generateText({
      model: google(attempt === 1 ? AI_CONFIG.model : AI_CONFIG.fallbackModel),
      system: SYSTEM,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: "Transcribe this note." },
            { type: "file", data: bytes, mediaType },
          ],
        },
      ],
      // Transcription is recall, not composition. Sampling here invents words
      // that were never said — the same reason the parser pins this to 0.
      temperature: 0,
    });

    return result.text;
  } catch (err) {
    const message = err instanceof Error ? err.message : "";
    const rateLimited = /429|quota|rate.?limit|resource.?exhausted/i.test(message);

    // Same backoff shape as the parser's callModel. The free tier rate-limits
    // per minute, and a retry usually clears it.
    if (rateLimited && attempt < 3) {
      await new Promise((r) => setTimeout(r, attempt * 2500));
      return callModel(bytes, mediaType, attempt + 1);
    }

    throw err;
  }
}

export async function transcribeAudio(
  bytes: Uint8Array,
  mediaType: string
): Promise<TranscribeResult> {
  if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
    return { ok: false, error: "Speech-to-text isn't configured" };
  }

  try {
    const raw = await callModel(bytes, mediaType);
    const text = raw.trim();

    if (!text || text === "NO_SPEECH") {
      return { ok: false, error: "Didn't catch that — try recording again" };
    }

    // The model is told to return bare text, but a stray wrapping quote is the
    // one formatting habit that survives the instruction often enough to strip.
    const unwrapped = text.replace(/^["“]|["”]$/g, "").trim();

    return { ok: true, text: unwrapped.slice(0, AI_CONFIG.maxInputChars) };
  } catch (err) {
    const message = err instanceof Error ? err.message : "";
    if (/429|quota|rate.?limit|resource.?exhausted/i.test(message)) {
      return { ok: false, error: "Speech-to-text is busy — try again shortly" };
    }
    return { ok: false, error: "Couldn't read that recording" };
  }
}
