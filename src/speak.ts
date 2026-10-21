import { rupees, compositionText } from './format';
import { saving } from './match/equivalence';
import type { Hit } from './match/types';
import type { Ctx } from './ui/ctx';

/**
 * Text-to-Speech (TTS) helper designed for visually impaired and blind users.
 * Supports speaking medicine details, prices, and savings in both Hindi and English.
 */

export function canSpeak(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

export function stopSpeaking(): void {
  if (canSpeak()) {
    try {
      window.speechSynthesis.cancel();
    } catch {
      /* ignore */
    }
  }
}

export function speak(text: string, lang: 'hi' | 'en' = 'hi'): void {
  if (!canSpeak()) return;
  stopSpeaking();

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = lang === 'hi' ? 'hi-IN' : 'en-IN';
  utterance.rate = 0.95; // Slightly slower for clear medical understanding

  // Find appropriate voice if available
  const voices = window.speechSynthesis.getVoices();
  if (voices.length > 0) {
    if (lang === 'hi') {
      const hiVoice = voices.find((v) => v.lang.startsWith('hi') || v.name.toLowerCase().includes('hindi'));
      if (hiVoice) utterance.voice = hiVoice;
    } else {
      const enVoice = voices.find((v) => v.lang.startsWith('en-IN')) || voices.find((v) => v.lang.startsWith('en'));
      if (enVoice) utterance.voice = enVoice;
    }
  }

  try {
    window.speechSynthesis.speak(utterance);
  } catch {
    /* ignore */
  }
}

/**
 * Announce medicine comparison aloud for accessibility.
 */
export function speakHit(hit: Hit, ctx: Ctx): void {
  const isHi = ctx.lang === 'hi';

  if (hit.type === 'brand') {
    const b = hit.brand;
    const comp = compositionText(b.comp, ctx.molecules, ctx.lang);

    if (!hit.group) {
      const msg = isHi
        ? `दवा ${b.name}। साल्ट है ${comp}। ब्रांड कीमत ${rupees(b.mrp)}। इस दवा का कोई सीधा जन औषधि विकल्प उपलब्ध नहीं है।`
        : `Medicine ${b.name}. Salt is ${comp}. Brand price is ${rupees(b.mrp)}. No exact Jan Aushadhi substitute in database.`;
      speak(msg, ctx.lang);
      return;
    }

    const s = saving(b, hit.group);
    const msg = isHi
      ? `दवा ${b.name}। जन औषधि विकल्प है ${s.generic.name}। ब्रांड की कीमत ${rupees(s.brandPrice)}। जन औषधि की कीमत सिर्फ ${rupees(s.genericPrice)}। आपकी बचत ${rupees(s.saving)} रुपये, यानी ${s.pct} प्रतिशत की बचत!`
      : `Medicine ${b.name}. Jan Aushadhi generic is ${s.generic.name}. Brand price is ${rupees(s.brandPrice)}. Jan Aushadhi price is only ${rupees(s.genericPrice)}. You save ${rupees(s.saving)} rupees, that is ${s.pct} percent savings!`;

    speak(msg, ctx.lang);
  } else {
    const g = hit.group.items[0];
    const comp = compositionText(hit.group.comp, ctx.molecules, ctx.lang);
    const msg = isHi
      ? `साल्ट ${comp}। जन औषधि दवा ${g.name}। कीमत ${rupees(g.mrp)}।`
      : `Salt ${comp}. Jan Aushadhi medicine ${g.name}. Price is ${rupees(g.mrp)}.`;
    speak(msg, ctx.lang);
  }
}
