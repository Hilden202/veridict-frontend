export type ActivityKind = 'catalog' | 'search' | 'detail' | 'analysis';
export type ActivityPhase = 'connecting' | 'working';

export function remainingSeconds(elapsed: number, estimate: number): number {
  return Math.max(0, Math.ceil(estimate - elapsed));
}

export function waitEstimate(kind: ActivityKind, elapsed: number, phase: ActivityPhase, previous?: number): number {
  if (phase === 'connecting' && elapsed >= 4) return kind === 'analysis' ? 105 : 75;
  const fallback = kind === 'analysis' ? 45 : 3;
  return Math.max(fallback, Math.min(kind === 'analysis' ? 180 : 90, Math.ceil((previous ?? fallback) * 1.25)));
}

export function addressFromQuery(value: string): string {
  const text = value.trim();
  if (/\s/.test(text) || !/^(https?:\/\/|www\.)|^[a-z\d-]+(?:\.[a-z\d-]+)+(?:[/:?#]|$)/i.test(text)) return '';
  try {
    const url = new URL(/^https?:\/\//i.test(text) ? text : `https://${text}`);
    return /^https?:$/.test(url.protocol) && url.hostname.includes('.') ? url.href : '';
  } catch { return ''; }
}
