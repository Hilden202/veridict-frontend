<script lang="ts">
  import { onMount } from 'svelte';
  import { imageSource, type AnalysisResult } from '$lib/catalog';
  let { analysis, apiBase, assetBase }: { analysis: AnalysisResult; apiBase: string; assetBase: string } = $props();
  let src = $state('');
  let full = $state('');
  let loading = $state(false);
  let failed = $state(false);
  let controller: AbortController | undefined;
  let attempted = false;

  function applyImages(data: AnalysisResult) {
    const item = { ...data, id: data.id || '', url: data.url || '' };
    src = imageSource(item, apiBase, assetBase);
    full = imageSource({ ...item, imageUrl: data.screenshotUrl || data.screenshotPath || src }, apiBase, assetBase);
  }

  async function load(refresh = false) {
    if (!analysis.id || loading) return;
    controller?.abort();
    const request = new AbortController();
    controller = request;
    attempted = true;
    loading = true; failed = false;
    const timeout = setTimeout(() => request.abort(), 120000);
    try {
      while (!request.signal.aborted) {
        const response = await fetch(`${apiBase}/analyses/${encodeURIComponent(analysis.id)}/preview${refresh ? '?refresh=true' : ''}`, { method: 'POST', signal: request.signal });
        if (response.status === 202) { await new Promise(resolve => setTimeout(resolve, 3000)); continue; }
        if (!response.ok) throw new Error();
        const data = await response.json();
        if (data.state !== 'ready') throw new Error();
        if (request.signal.aborted) return;
        applyImages(data);
        if (!src) throw new Error();
        return;
      }
    } catch { if (controller === request) failed = true; }
    finally { clearTimeout(timeout); if (controller === request) loading = false; }
  }

  onMount(() => {
    applyImages(analysis);
    if (!src) load();
    return () => { controller?.abort(); controller = undefined; };
  });
</script>

<figure class="preview-panel" aria-label="Förhandsvisning av webbplatsen">
  {#if src && !failed}
    <a href={full || src} target="_blank" rel="noopener noreferrer" aria-label="Öppna större bild i ny flik"><img {src} alt={`Förhandsvisning av ${analysis.siteTitle || analysis.title || analysis.url}`} width="960" height="600" onerror={() => { src = ''; if (!attempted) load(); else failed = true; }} /></a>
    <figcaption>Förhandsvisning av sidan · <a href={full || src} target="_blank" rel="noopener noreferrer">Visa större ↗</a></figcaption>
  {:else if loading}
    <div class="preview-placeholder" role="status"><span class="spinner" aria-hidden="true"></span><strong>Hämtar bild…</strong><p>Bedömningen är klar och går att läsa medan bilden hämtas.</p></div>
  {:else}
    <div class="preview-placeholder"><strong>{failed ? 'Bilden kunde inte visas just nu' : 'Ingen bild hämtad ännu'}</strong><p>Det påverkar inte din bedömning eller om sidan är granskad.</p>{#if analysis.id}<button type="button" onclick={() => load(true)}>Hämta bild igen</button>{/if}</div>
  {/if}
</figure>

<style>
  .preview-panel{margin:22px 0;border:1px solid #3b5544;border-radius:12px;overflow:hidden;background:#14221b}.preview-panel>a,.preview-placeholder{display:flex;max-width:560px;width:100%;aspect-ratio:8/5;margin:0 auto;overflow:hidden}img{display:block;width:100%;height:100%;object-fit:cover;object-position:top center}figcaption{padding:10px 16px;font-size:.72rem;color:#b8cdbf}figcaption a{color:#b8d9c2}.preview-placeholder{align-items:center;justify-content:center;flex-direction:column;gap:9px;padding:24px;text-align:center;color:#cee0d3}.preview-placeholder strong{font-size:.85rem}.preview-placeholder p{margin:0;font-size:.75rem;line-height:1.6;color:#aebfb3}.preview-placeholder button{background:#2d6048;border:1px solid #5d846b;border-radius:7px;padding:9px 14px;color:white;font-size:.8rem;cursor:pointer}.spinner{height:28px;width:28px;flex:0 0 28px;border:3px solid #405b49;border-top-color:#a6cfb5;border-radius:50%;animation:spin 1s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}@media(max-width:600px){.preview-placeholder{padding:15px;gap:7px}.preview-placeholder p{font-size:.7rem}}@media(prefers-reduced-motion:reduce){.spinner{animation-duration:3s}}
</style>
