'use client';

import { useState } from 'react';
import { clearGeminiKey, getSavedGeminiKey, saveGeminiKey } from '@/lib/gemini';
import { Button } from './ui';
import { Icon } from './Icon';

/**
 * BYOK field: saves the visitor's Gemini key in THEIR browser only.
 * Requests then go directly from their browser to Google.
 */
export default function GeminiKeyField({ onChanged }: { onChanged: () => void }) {
  const [saved, setSaved] = useState<string>(() => getSavedGeminiKey());
  const [draft, setDraft] = useState('');

  if (saved) {
    return (
      <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-3">
        <p className="flex items-center gap-1.5 text-sm font-medium text-indigo-900">
          <Icon name="shield" className="h-4 w-4" />
          Your Gemini key is saved in this browser
        </p>
        <p className="mt-1 font-mono text-xs text-indigo-700">••••••••••••{saved.slice(-4)}</p>
        <div className="mt-2.5 flex gap-2">
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              setSaved('');
              setDraft('');
            }}
          >
            Replace
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              clearGeminiKey();
              setSaved('');
              onChanged();
            }}
          >
            Remove
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
      <label className="mb-1.5 block text-sm font-medium text-gray-700" htmlFor="gemini-key">
        Your Gemini API key (BYOK — optional)
      </label>
      <input
        id="gemini-key"
        type="password"
        autoComplete="off"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder="paste your key…"
        className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 font-mono text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
      />
      <Button
        size="sm"
        className="mt-2 w-full"
        disabled={draft.trim().length < 10}
        onClick={() => {
          saveGeminiKey(draft);
          setSaved(getSavedGeminiKey());
          onChanged();
        }}
      >
        Save key in this browser
      </Button>
      <p className="mt-2 text-xs leading-relaxed text-gray-500">
        The key is stored only in <strong>this browser</strong> and requests go{' '}
        <strong>directly from your browser to Google</strong> — this site never sees your key or your images. No key? The
        request falls back to our server route if configured.{' '}
        <a className="font-medium text-indigo-600 underline" href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer">
          Get a free key →
        </a>
      </p>
    </div>
  );
}
