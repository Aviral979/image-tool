// BYOK (Bring Your Own Key): the visitor's Gemini key lives ONLY in their
// browser's localStorage and requests go straight from their browser to
// Google — this site's server never sees the key or their images.

const STORAGE_KEY = 'imagetool.geminiKey';

export function getSavedGeminiKey(): string {
  if (typeof window === 'undefined') return '';
  return window.localStorage.getItem(STORAGE_KEY) ?? '';
}

export function saveGeminiKey(key: string): void {
  window.localStorage.setItem(STORAGE_KEY, key.trim());
}

export function clearGeminiKey(): void {
  window.localStorage.removeItem(STORAGE_KEY);
}

const MODELS = ['gemini-3.1-flash-image', 'gemini-2.5-flash-image', 'gemini-3-pro-image-preview'];

const PROMPT =
  'Upscale and enhance this image. Increase its resolution and fine detail while keeping the exact same content, ' +
  'composition, colors and style. Do not add or remove anything. Output only the enhanced image.';

async function blobToBase64(blob: Blob): Promise<string> {
  const buf = new Uint8Array(await blob.arrayBuffer());
  let s = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < buf.length; i += CHUNK) {
    s += String.fromCharCode(...buf.subarray(i, i + CHUNK));
  }
  return window.btoa(s);
}

function base64ToBlob(b64: string, mime: string): Blob {
  const bin = window.atob(b64);
  const buf = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  return new Blob([buf], { type: mime });
}

/** Calls Google directly from the browser with the user's own key. */
export async function geminiEnhanceRaw(file: Blob, apiKey: string, report: (p: number) => void): Promise<Blob> {
  const data = await blobToBase64(file);
  const payload = JSON.stringify({
    contents: [{ parts: [{ text: PROMPT }, { inlineData: { mimeType: file.type, data } }] }],
    generationConfig: { responseModalities: ['TEXT', 'IMAGE'] },
  });

  let lastError: string | null = null;
  for (const model of MODELS) {
    report(0.1);
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: payload,
    });
    if (res.status === 404) {
      lastError = 'No image-capable Gemini model is available for this key.';
      continue;
    }
    if (res.status === 429) {
      lastError = 'Gemini quota full (image generation needs billing on free keys), or slow down and retry.';
      continue;
    }
    const json: any = await res.json().catch(() => null);
    if (!res.ok) {
      const msg: string = json?.error?.message ?? '';
      throw new Error(msg ? `Gemini rejected the request: ${msg.slice(0, 180)}` : 'Gemini rejected the request. Check your API key.');
    }
    const parts: any[] = json?.candidates?.[0]?.content?.parts ?? [];
    const imgPart = parts.find((p) => p?.inlineData?.data || p?.inline_data?.data);
    const b64: string | undefined = imgPart?.inlineData?.data ?? imgPart?.inline_data?.data;
    if (!b64) {
      lastError = 'The AI returned no image. Please try again.';
      continue;
    }
    const mime: string = imgPart?.inlineData?.mimeType ?? imgPart?.inline_data?.mime_type ?? 'image/png';
    return base64ToBlob(b64, mime);
  }
  throw new Error(lastError ?? 'No compatible Gemini image model available for this key.');
}
