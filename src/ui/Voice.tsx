import { useState } from 'preact/hooks';
import { spokenToText } from '../match/spoken';
import type { Ctx } from './ctx';

/* Voice input via the phone's built-in speech recognition (Chrome on Android, Edge, Safari).
   Recognised in Indian English, because brand names are spoken in Latin letters ("Dolo six fifty").
   The text goes through exactly the same matcher as typing; nothing is interpreted. Hidden if unsupported. */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Recognition = any;

const Impl: (new () => Recognition) | undefined =
  typeof window !== 'undefined' ? ((window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition) : undefined;

export function Voice({ ctx, onText }: { ctx: Ctx; onText: (s: string) => void }) {
  const [state, setState] = useState<'idle' | 'listening' | 'failed'>('idle');
  if (!Impl) return null;

  const start = () => {
    const rec = new Impl();
    rec.lang = 'en-IN';
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    rec.onresult = (e: any) => {
      const said = e.results?.[0]?.[0]?.transcript ?? '';
      if (said) onText(spokenToText(said));
      setState('idle');
    };
    rec.onerror = () => setState('failed');
    rec.onend = () => setState((s) => (s === 'listening' ? 'idle' : s));
    setState('listening');
    try {
      rec.start();
    } catch {
      setState('failed');
    }
  };

  return (
    <div class="voice">
      <button class={`big secondary ${state === 'listening' ? 'listening' : ''}`} onClick={start} disabled={state === 'listening'}>
        🎤 {state === 'listening' ? ctx.t.listening : ctx.t.voice}
      </button>
      {state === 'failed' && <p class="warn small">{ctx.t.voiceFailed}</p>}
    </div>
  );
}
