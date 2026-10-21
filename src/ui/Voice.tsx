import { useState } from 'preact/hooks';
import { spokenToText } from '../match/spoken';
import { stopSpeaking } from '../speak';
import type { Ctx } from './ctx';

/* Voice input via the phone's built-in speech recognition (Chrome on Android, Edge, Safari).
   Recognised in Hindi or Indian English depending on user selection.
   The text goes through exactly the same matcher as typing; nothing is interpreted. Hidden if unsupported. */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Recognition = any;

const Impl: (new () => Recognition) | undefined =
  typeof window !== 'undefined' ? ((window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition) : undefined;

export function Voice({ ctx, onText, compact = false }: { ctx: Ctx; onText: (s: string) => void; compact?: boolean }) {
  const [state, setState] = useState<'idle' | 'listening' | 'failed'>('idle');
  if (!Impl) return null;

  const start = () => {
    stopSpeaking();
    const rec = new Impl();
    rec.lang = ctx.lang === 'hi' ? 'hi-IN' : 'en-IN';
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
      {compact ? (
        <button class={`tile ${state === 'listening' ? 'listening' : ''}`} onClick={start} disabled={state === 'listening'}>
          <span class="tile-icon" aria-hidden="true">🎤</span>{state === 'listening' ? ctx.t.tileListening : ctx.t.tileVoice}
        </button>
      ) : (
        <button class={`big secondary ${state === 'listening' ? 'listening' : ''}`} onClick={start} disabled={state === 'listening'}>
          🎤 {state === 'listening' ? ctx.t.listening : ctx.t.voice}
        </button>
      )}
      {state === 'failed' && <p class="warn small">{ctx.t.voiceFailed}</p>}
    </div>
  );
}
