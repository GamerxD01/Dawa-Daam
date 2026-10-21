// Tiny persistence helpers. Browser storage can be missing or throw (private mode, previews),
// so every access is guarded and the app works without it.
import type { Hit } from './match/types';

export const hitId = (h: Hit) => (h.type === 'brand' ? `b:${h.brand.id}` : `g:${h.group.key}`);

export function load<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(key);
    return v ? (JSON.parse(v) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function save(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable: keep working in memory */
  }
}
