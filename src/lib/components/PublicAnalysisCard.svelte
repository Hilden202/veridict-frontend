<script lang="ts">
  import {
    imageSource,
    publicUrl,
    siteHost,
    type CatalogItem,
  } from "$lib/catalog";
  type Props = {
    item: CatalogItem;
    apiBase?: string;
    publicAssetBase?: string;
    compact?: boolean;
    oninspect?: (item: CatalogItem) => void;
  };
  let { item, apiBase = "", publicAssetBase = "", oninspect }: Props = $props();
  const src = $derived(imageSource(item, apiBase, publicAssetBase));
  let failedSource = $state("");
</script>

<article class="card">
  <div class="preview">
    {#if src && failedSource !== src}
      <img
        {src}
        alt={`Förhandsvisning av ${item.title || siteHost(item.url)}`}
        loading="lazy"
        decoding="async"
        width="640"
        height="400"
        onerror={() => (failedSource = src)}
      />
    {:else}
      <div class="fallback">
        <span aria-hidden="true">V.</span><small>Ingen förhandsvisning</small>
      </div>
    {/if}
    <span class="category">{item.category || "Webbplats"}</span>
  </div>
  <div class="body">
    <div class="heading">
      <h3>{item.title || siteHost(item.url)}</h3>
      <div
        class="score"
        aria-label={`Kvalitetspoäng ${item.score?.toFixed(1) ?? "saknas"} av 10`}
      >
        <strong>{item.score?.toFixed(1) ?? "–"}</strong><span>/10</span>
      </div>
    </div>
    <span class="host">{siteHost(item.url)}</span>
    <p>{item.summary || "En granskad sida i Veridicts katalog."}</p>
    {#if item.topics?.length}<ul class="topics" aria-label="Ämnen">
        {#each item.topics.slice(0, 3) as topic}<li>{topic}</li>{/each}
      </ul>{/if}
    <div class="actions">
      {#if oninspect}<button
          type="button"
          onclick={() => oninspect?.(item)}
          aria-label={`Visa bedömning av ${item.title || siteHost(item.url)}`}
          >Visa bedömning <span aria-hidden="true">→</span></button
        >{/if}
      {#if publicUrl(item.url)}<a
          href={publicUrl(item.url)}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Besök ${siteHost(item.url)} (öppnas i ny flik)`}
          >Besök sidan ↗</a
        >{/if}
    </div>
  </div>
</article>

<style>
  .card {
    background: #fff;
    border: 1px solid #dce5df;
    border-radius: 18px;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    min-width: 0;
    transition:
      border-color 0.2s,
      box-shadow 0.2s;
  }
  .card:hover {
    border-color: #a5bdb0;
    box-shadow: 0 9px 26px #243c3010;
  }
  .preview {
    aspect-ratio: 8/5;
    background: #edf1eb;
    position: relative;
    overflow: hidden;
    border-bottom: 1px solid #e6ece6;
  }
  img {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: cover;
    object-position: top center;
  }
  .category {
    position: absolute;
    left: 14px;
    bottom: 12px;
    background: #fffffff2;
    border: 1px solid #dce5df;
    border-radius: 6px;
    padding: 5px 9px;
    font-size: 0.72rem;
    font-weight: 650;
    color: #354b40;
  }
  .fallback {
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-direction: column;
    gap: 10px;
    color: #61746a;
  }
  .fallback span {
    font-family: Georgia, serif;
    font-size: 3rem;
    color: #61705e;
  }
  .fallback small {
    font-size: 0.8rem;
  }
  .body {
    padding: 22px;
    display: flex;
    flex-direction: column;
    flex: 1;
  }
  .heading {
    display: flex;
    gap: 10px;
    align-items: start;
    justify-content: space-between;
  }
  h3 {
    margin: 0;
    font-size: 1.08rem;
    line-height: 1.45;
    overflow-wrap: anywhere;
    color: #203d31;
  }
  .score {
    display: flex;
    align-items: baseline;
    gap: 2px;
    white-space: nowrap;
    color: #225e49;
  }
  .score strong {
    font-size: 1.3rem;
  }
  .score span {
    font-size: 0.72rem;
    color: #61705e;
  }
  .host {
    font-size: 0.76rem;
    color: #61705e;
    margin-top: 5px;
  }
  p {
    font-size: 0.88rem;
    line-height: 1.65;
    color: #53645a;
    margin: 16px 0;
    display: -webkit-box;
    -webkit-line-clamp: 3;
    line-clamp: 3;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
  .topics {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
    list-style: none;
    margin: 0 0 20px;
    padding: 0;
  }
  .topics li {
    font-size: 0.68rem;
    color: #52675a;
    background: #f1f4ee;
    border-radius: 5px;
    padding: 4px 7px;
  }
  .actions {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    flex-wrap: wrap;
    margin-top: auto;
    padding-top: 16px;
    border-top: 1px solid #edf0eb;
  }
  .actions button {
    border: 0;
    background: none;
    padding: 4px 0;
    color: #24624b;
    font: inherit;
    font-size: 0.82rem;
    font-weight: 700;
    cursor: pointer;
  }
  .actions a {
    color: #64746b;
    font-size: 0.76rem;
    text-decoration: none;
  }
  .actions a:hover {
    text-decoration: underline;
  }
  .actions button:hover {
    color: #123f2c;
  }
  .actions :focus-visible {
    outline: 3px solid #a5c9b7;
    outline-offset: 4px;
    border-radius: 3px;
  }
</style>
