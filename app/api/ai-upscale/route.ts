import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const maxDuration = 60;

// Image-generating Gemini models, tried in order (first one available wins).
const MODEL_CANDIDATES = [
  process.env.GEMINI_IMAGE_MODEL || 'gemini-3.1-flash-image',
  'gemini-2.5-flash-image',
  'gemini-3-pro-image-preview',
  'gemini-2.0-flash-exp-image-generation',
];

const PROMPT =
  'Upscale and enhance this image. Increase its resolution and fine detail while keeping the exact same content, ' +
  'composition, colors and style. Do not add or remove anything. Output only the enhanced image.';

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

/**
 * POST /api/ai-upscale
 * Accepts multipart form: image (file), returns the AI-enhanced image bytes.
 * The image is held in memory for the duration of the request only — nothing is written to disk or a database.
 */
export async function POST(req: NextRequest) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    return jsonError('The AI engine is not configured on this server.', 500);
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return jsonError('The upload could not be read.', 400);
  }

  const file = form.get('image');
  if (!(file instanceof File)) return jsonError('No image was provided.', 400);
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
    return jsonError('Unsupported file type. Please upload a JPG, PNG or WebP image.', 415);
  }
  if (file.size > 12 * 1024 * 1024) {
    return jsonError('This image is too large for the AI engine (max 12 MB). Try compressing it first.', 413);
  }

  const imageB64 = Buffer.from(await file.arrayBuffer()).toString('base64');

  // Gemini API keys authenticate via the x-goog-api-key header.
  const headers: Record<string, string> = { 'Content-Type': 'application/json', 'x-goog-api-key': key };

  const payload = JSON.stringify({
    contents: [
      {
        parts: [
          { text: PROMPT },
          { inlineData: { mimeType: file.type, data: imageB64 } },
        ],
      },
    ],
    generationConfig: { responseModalities: ['TEXT', 'IMAGE'] },
  });

  let lastError: string | null = null;

  for (const model of MODEL_CANDIDATES) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
    let res: Response;
    try {
      res = await fetch(url, { method: 'POST', headers, body: payload, signal: AbortSignal.timeout(55000) });
    } catch {
      return jsonError('The AI service did not respond in time. Please try again.', 504);
    }

    if (res.status === 404 || res.status === 403) {
      // Model may not exist / not enabled for this key — try the next candidate.
      const detail = await res.text().catch(() => '');
      if (res.status === 404) continue;
      if (res.status === 403 && detail.includes('model')) continue;
      if (res.status === 403) {
        return jsonError('The API key was rejected by Google. Check that the Gemini API is enabled for this key.', 502);
      }
    }

    const data: any = await res.json().catch(() => null);
    if (!res.ok) {
      const msg: string = data?.error?.message || `Gemini API error (${res.status})`;
      if (res.status === 401 || res.status === 400) {
        return jsonError(`Gemini rejected the request: ${msg}`, 502);
      }
      if (res.status === 429) {
        // Try the next model; remember the most useful message for the final answer.
        lastError = msg.includes('limit: 0')
          ? 'This Google account has 0 free image-generation quota — Gemini image models need billing enabled. Use Browser mode (free) meanwhile.'
          : 'The AI engine is rate-limited right now. Please wait a moment and try again.';
        continue;
      }
      return jsonError(msg, 502);
    }

    const parts: any[] = data?.candidates?.[0]?.content?.parts ?? [];
    const imgPart = parts.find((p) => p?.inlineData?.data || p?.inline_data?.data);
    const b64: string | undefined = imgPart?.inlineData?.data ?? imgPart?.inline_data?.data;
    const mime: string = imgPart?.inlineData?.mimeType ?? imgPart?.inline_data?.mime_type ?? 'image/png';

    if (!b64) {
      const text = parts.find((p) => typeof p?.text === 'string')?.text;
      return jsonError(
        text ? `The AI returned text instead of an image: ${text.slice(0, 140)}` : 'The AI returned no image. Please try again.',
        502
      );
    }

    const out = Buffer.from(b64, 'base64');
    return new NextResponse(new Blob([out], { type: mime }), {
      headers: { 'Content-Type': mime, 'Cache-Control': 'no-store' },
    });
  }

  return jsonError(lastError ?? 'No compatible Gemini image model is available for this API key.', lastError ? 429 : 502);
}
