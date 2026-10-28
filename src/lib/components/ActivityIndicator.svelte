<script lang="ts">
  import { onMount } from 'svelte';
  import { remainingSeconds, waitEstimate, type ActivityKind, type ActivityPhase } from '$lib/activity';
  let { kind, phase = 'working', previous }: { kind: ActivityKind; phase?: ActivityPhase; previous?: number } = $props();
  let elapsed = $state(0);
  let phaseStartedAt = Date.now();
  $effect(() => { void phase; phaseStartedAt = Date.now(); elapsed = 0; });
  const estimate = $derived(waitEstimate(kind, elapsed, phase, previous));
  const remaining = $derived(remainingSeconds(elapsed, estimate));
  const delayedConnection = $derived(phase === 'connecting' && elapsed >= 4);
  const label = $derived(phase === 'connecting'
    ? delayedConnection ? 'Servern kan vara i kallstart' : 'Ansluter till servern…'
    : kind === 'analysis' ? 'Läser och bedömer sidan…'
    : kind === 'detail' ? 'Hämtar bedömningen…'
    : kind === 'search' ? 'Söker i katalogen…' : 'Hämtar katalogen…');
  onMount(() => {
    const timer = setInterval(() => elapsed = Math.floor((Date.now() - phaseStartedAt) / 1000), 1000);
    return () => clearInterval(timer);
  });
</script>

<div class="activity" role="status" aria-live="polite">
  <div class="dial" aria-hidden="true"><svg viewBox="0 0 72 72"><circle class="track" cx="36" cy="36" r="30" /><circle class="spinner" cx="36" cy="36" r="30" /></svg><span>{remaining > 0 ? `~${remaining}s` : `${elapsed}s`}</span></div>
  <div class="copy"><strong>{label}</strong><p>{remaining > 0 ? 'Ungefärlig tid kvar – räknas ner medan du väntar.' : 'Det tar längre tid än uppskattat. Vi väntar fortfarande på svar.'}</p>{#if delayedConnection}<small>En långsam anslutning kan också vara orsaken. Vi kan inte bekräfta kallstart förrän servern svarar.</small>{:else if kind === 'analysis'}<small>En sparad bedömning går ofta snabbare. En ny analys kan ta längre tid.</small>{/if}</div>
</div>

<style>
  .activity{display:flex;align-items:center;gap:18px;padding:20px;border:1px solid #405b52;background:#1c302b;border-radius:14px;text-align:left;color:#edf3ee;scroll-margin-top:15px}.dial{position:relative;width:72px;height:72px;flex:0 0 72px}.dial svg{width:100%;height:100%;transform:rotate(-90deg)}circle{fill:none;stroke-width:4}.track{stroke:#3a5148}.spinner{stroke:#9ac5ac;stroke-linecap:round;stroke-dasharray:60 190;transform-origin:center;animation:turn 1.1s linear infinite}.dial>span{position:absolute;inset:0;display:grid;place-items:center;font-size:.85rem;font-variant-numeric:tabular-nums;color:#d1e5d7}.copy strong{font-size:.9rem}.copy p{font-size:.76rem;line-height:1.6;margin:5px 0;color:#c1cfc5}.copy small{display:block;font-size:.7rem;line-height:1.6;color:#aebeb2}@keyframes turn{to{transform:rotate(360deg)}}@media(max-width:600px){.activity{padding:15px;gap:12px}.dial{width:60px;height:60px;flex-basis:60px}.copy strong{font-size:.84rem}}@media(prefers-reduced-motion:reduce){.spinner{animation-duration:3s}}
</style>
