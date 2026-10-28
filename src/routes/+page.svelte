<script lang="ts">
  import ActivityIndicator from '$lib/components/ActivityIndicator.svelte';
  import { addressFromQuery, type ActivityKind, type ActivityPhase } from '$lib/activity';
  import { onMount, tick } from "svelte";
  import {
    getApiEnvironmentConfig,
    getPublicFrontendEnvironmentMode,
  } from "$lib/apiEnvironment";
  import PublicAnalysisCard from "$lib/components/PublicAnalysisCard.svelte";
  import {
    publicUrl,
    siteHost,
    type CatalogItem,
    type AnalysisResult,
  } from "$lib/catalog";

  let apiBase = $state("");
  let assetBase = $state("");
  let query = $state("");
  let category = $state("");
  let sort = $state("relevance");
  let categories = $state<string[]>([]);
  let featured = $state<CatalogItem[]>([]);
  let results = $state<CatalogItem[]>([]);
  let loading = $state(true);
  let error = $state("");
  let searched = $state(false);
  let submittedQuery = $state("");
  let visibleCount = $state(9);
  let requestId = 0;
  let selected = $state<AnalysisResult | null>(null);
  let detailLoading = $state(false);
  let detailError = $state("");
  let detailRequestId = 0;
  let detailHeading: HTMLHeadingElement | undefined = $state();
  let searchInput: HTMLInputElement | undefined = $state();
  let url = $state("");
  let submitting = $state(false);
  let activityKind = $state<ActivityKind>('catalog');
  let activityPhase = $state<ActivityPhase>('connecting');
  let activitySequence = $state(0);
  let activityPrevious = $state<number | undefined>();
  let healthPromise: Promise<void> | null = null;
  let lastReadyAt = 0;
  let activityStartedAt = 0;
  let progressPanel: HTMLDivElement | undefined = $state();
  let suggestPanel: HTMLDetailsElement | undefined = $state();
  const busy = $derived(loading || submitting || detailLoading);
  const queryAddress = $derived(addressFromQuery(submittedQuery));

  function beginActivity(kind: ActivityKind) {
    activityKind = kind;
    activitySequence += 1;
    activityStartedAt = Date.now();
    activityPhase = Date.now() - lastReadyAt < 60000 ? 'working' : 'connecting';
    try { activityPrevious = Number(localStorage.getItem(`veridict:duration:${kind}`)) || undefined; } catch { activityPrevious = undefined; }
  }

  function endActivity(kind: ActivityKind) {
    const seconds = (Date.now() - activityStartedAt) / 1000;
    try { localStorage.setItem(`veridict:duration:${kind}`, String(seconds)); } catch { /* Optional timing history. */ }
  }

  async function ensureBackend() {
    if (Date.now() - lastReadyAt < 60000) { activityPhase = 'working'; return; }
    if (!healthPromise) {
      healthPromise = (async () => {
        try {
          const response = await fetch(`${apiBase}/health`, { signal: AbortSignal.timeout(95000), cache: 'no-store' });
          if (!response.ok && response.status !== 404) throw new Error('Servern svarar inte just nu.');
          // A 404 allows a frontend-first deployment to keep working against the older API.
          lastReadyAt = Date.now();
        } finally { healthPromise = null; }
      })();
    }
    await healthPromise;
    activityPhase = 'working';
  }

  async function revealProgress() {
    await tick();
    progressPanel?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function contentMessage(result: AnalysisResult) {
    if (result.contentState === 'VerificationBlocked') return 'Webbplatsen visar en verifierings- eller säkerhetssida. Vi kan inte bedöma innehållet bakom den.';
    if (result.contentState === 'InsufficientContent') return 'Vi kunde inte läsa tillräckligt av sidans innehåll. Det kan bero på JavaScript-laddning, inloggning eller ett tillfälligt hämtningsfel. Ingen kvalitetspoäng har satts.';
    return result.contentStateReason || 'Underlaget räcker inte för en tillförlitlig bedömning.';
  }

  async function analyzeSearchAddress() {
    url = queryAddress;
    if (suggestPanel) suggestPanel.open = true;
    await submitSite();
  }
  let submissionError = $state("");
  let submissionResult = $state<AnalysisResult | null>(null);
  const items = $derived(searched ? results : featured);
  const scorable = $derived(
    selected && (!selected.contentState || selected.contentState === "Ready"),
  );
  const metrics = $derived([
    {
      label: "Relevans",
      value: selected?.relevance,
      note: "Matchning mot sidans bedömda syfte",
    },
    {
      label: "Tydlighet",
      value: selected?.clarity,
      note: "Hur begripligt innehållet är",
    },
    {
      label: "Praktiskt värde",
      value: selected?.practicalValue,
      note: "Vad besökaren faktiskt får ut av sidan",
    },
    { label: "Brus", value: selected?.noiseLevel, note: "Lägre är bättre" },
  ]);

  function date(value?: string) {
    if (!value || Number.isNaN(Date.parse(value))) return "Datum saknas";
    return new Intl.DateTimeFormat("sv-SE", { dateStyle: "medium" }).format(
      new Date(value),
    );
  }

  async function loadCatalog() {
    const current = ++requestId;
    loading = true;
    beginActivity('catalog');
    error = "";
    try {
      await ensureBackend();
      const [top, cats] = await Promise.all([
        fetch(`${apiBase}/catalog/top?limit=6`),
        fetch(`${apiBase}/catalog/categories`),
      ]);
      if (!top.ok || !cats.ok) throw new Error();
      const [data, groups] = await Promise.all([top.json(), cats.json()]);
      if (current !== requestId) return;
      featured = data;
      categories = groups;
    } catch {
      if (current === requestId)
        error = "Katalogen kunde inte laddas. Försök igen om en stund.";
    } finally {
      if (current === requestId) { loading = false; endActivity('catalog'); }
    }
  }

  async function search() {
    if (busy) return;
    const directAddress = addressFromQuery(query);
    if (directAddress) {
      ++requestId;
      selected = null;
      results = [];
      searched = false;
      error = '';
      url = directAddress;
      await submitSite(true);
      return;
    }
    const current = ++requestId;
    loading = true;
    error = "";
    beginActivity('search');
    revealProgress();
    const text = query.trim();
    searched = true;
    submittedQuery = text;
    try {
      await ensureBackend();
      const params = new URLSearchParams({ q: text, category, sort });
      const response = await fetch(`${apiBase}/catalog/search?${params}`);
      if (!response.ok) throw new Error();
      const data = await response.json();
      if (current !== requestId) return;
      results = data;
      visibleCount = 9;
    } catch {
      if (current === requestId)
        error = "Sökningen kunde inte genomföras. Försök igen.";
    } finally {
      if (current === requestId) { loading = false; endActivity('search'); }
    }
  }

  async function resetSearch() {
    query = "";
    category = "";
    sort = "relevance";
    searched = false;
    results = [];
    error = "";
    await loadCatalog();
    searchInput?.focus();
  }

  async function inspect(item: CatalogItem) {
    const current = ++detailRequestId;
    selected = null;
    detailError = "";
    detailLoading = true;
    beginActivity('detail');
    await tick();
    detailHeading?.focus();
    revealProgress();
    try {
      await ensureBackend();
      const response = await fetch(
        `${apiBase}/catalog/${encodeURIComponent(item.id)}`,
      );
      if (!response.ok) throw new Error();
      const data = await response.json();
      if (current === detailRequestId) selected = data;
    } catch {
      if (current === detailRequestId)
        detailError =
          "Bedömningen kunde inte hämtas. Försök att öppna den igen.";
    } finally {
      if (current === detailRequestId) { detailLoading = false; endActivity('detail'); }
    }
  }

  function closeDetail() {
    ++detailRequestId;
    selected = null;
    detailLoading = false;
    detailError = "";
    searchInput?.focus();
  }

  async function submitSite(retryUnavailable = false) {
    if (submitting || !url.trim()) return;
    const formatted = /^https?:\/\//i.test(url.trim())
      ? url.trim()
      : `https://${url.trim()}`;
    if (!publicUrl(formatted)) {
      submissionError =
        "Ange en giltig webbadress, till exempel https://example.com.";
      return;
    }
    submitting = true;
    beginActivity('analysis');
    revealProgress();
    submissionError = "";
    submissionResult = null;
    try {
      await ensureBackend();
      const response = await fetch(`${apiBase}/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: formatted, retryUnavailable }),
        signal: AbortSignal.timeout(180000),
      });
      if (!response.ok) throw new Error();
      submissionResult = await response.json();
      await showSubmission();
    } catch {
      submissionError =
        "Sidan kunde inte analyseras just nu. Kontrollera adressen och försök igen.";
    } finally {
      submitting = false;
      endActivity('analysis');
    }
  }

  async function showSubmission() {
    ++detailRequestId;
    selected = submissionResult;
    detailError = "";
    detailLoading = false;
    await tick();
    detailHeading?.focus();
    detailHeading?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  onMount(() => {
    const environment = getApiEnvironmentConfig(
      getPublicFrontendEnvironmentMode(),
    );
    apiBase = environment.apiBaseUrl;
    assetBase = environment.publicCatalogUrl;
    loadCatalog();
  });
</script>

<svelte:head>
  <title>Veridict – hitta webbsidor med verkligt värde</title>
  <meta
    name="description"
    content="Upptäck granskade webbsidor. Se vad de erbjuder, hur de bedöms och varför de kan vara användbara för dig."
  />
</svelte:head>

<a class="skip" href="#main">Hoppa till innehållet</a>
<header class="site-header">
  <a class="brand" href="/" aria-label="Veridict startsida"
    ><span class="brand-mark" aria-hidden="true">V</span>veridict<span
      class="brand-dot">.</span
    ></a
  >
  <nav aria-label="Huvudmeny">
    <a href="#search">Hitta en sida</a><a href="#about">Så fungerar det</a><a
      class="suggest-link"
      href="#suggest">Föreslå en sida <span aria-hidden="true">↗</span></a
    >
  </nav>
</header>

<main id="main">
  <section class="hero" id="search" aria-labelledby="hero-heading">
    <h1 id="hero-heading">
      Hitta det som faktiskt<br class="desktop-break" /> är <em>användbart.</em>
    </h1>
    <p class="intro">
      Upptäck webbsidor bedömda efter sitt innehåll.<br /> Se vad de erbjuder och
      varför de kan vara värda din tid.
    </p>
    <form
      class="search-form"
      onsubmit={(event) => {
        event.preventDefault();
        search();
      }}
      role="search"
    >
      <div class="search-main">
        <label class="sr-only" for="query"
          >Sök efter ett ämne eller en webbplats</label
        ><span class="search-icon" aria-hidden="true">⌕</span><input
          id="query"
          bind:this={searchInput}
          bind:value={query}
          type="search"
          maxlength="200"
          placeholder="Sök ämne eller analysera en webbadress"
        /><button class="primary" type="submit" disabled={busy}
          >{loading ? 'Söker…' : 'Sök'} <span aria-hidden="true">→</span></button
        >
      </div>
      <div class="filters">
        <label
          >Kategori<select bind:value={category}
            ><option value="">Alla kategorier</option
            >{#each categories as value}<option {value}>{value}</option
              >{/each}</select
          ></label
        ><label
          >Sortera efter<select bind:value={sort}
            ><option value="relevance">Bästa matchning</option><option
              value="top">Högst kvalitetspoäng</option
            ><option value="newest">Senast granskade</option></select
          ></label
        ><span class="filter-note">Ämne → katalog · webbadress → analys</span>
      </div>
    </form>
    {#if submissionError}<p class="error" role="alert">{submissionError}</p>{/if}
    {#if busy}<div class="active-progress" bind:this={progressPanel}>{#key activitySequence}<ActivityIndicator kind={activityKind} phase={activityPhase} previous={activityPrevious} />{/key}</div>{/if}
  </section>

  {#if detailLoading || selected || detailError}
    <section
      class="assessment"
      aria-labelledby="assessment-heading"
      aria-busy={detailLoading}
    >
      <div class="section-top">
        <span class="eyebrow">Bakom poängen</span><button
          class="text-button"
          onclick={closeDetail}>Stäng bedömning ×</button
        >
      </div>
      <h2 id="assessment-heading" bind:this={detailHeading} tabindex="-1">
        {detailLoading
          ? "Hämtar bedömningen…"
          : selected?.siteTitle ||
            selected?.title ||
            siteHost(selected?.url) ||
            "Bedömning"}
      </h2>
      {#if detailError}<p role="alert" class="error">{detailError}</p>{/if}
      {#if selected}
        <div class="assessment-meta">
          <span
            >Analyserad {date(
              selected.lastAnalyzedAt || selected.createdAt,
            )}</span
          >{#if selected.status !== "Approved" && !selected.alreadyApproved}<span class="pending"
              >Ditt resultat · inväntar granskning för katalogen</span
            >{:else}<span class="reviewed">Granskad för publicering</span>{/if}
        </div>
        {#if selected.intent}<p class="intent">
            <strong>Bedömt syfte:</strong>
            {selected.intent}
          </p>{/if}
        {#if scorable}
          <div class="assessment-summary">
            <div class="total">
              <strong>{selected.score?.toFixed(1) ?? "–"}</strong><span
                >av 10 i kvalitet</span
              >
            </div>
            <p>{selected.summary}</p>
          </div>
          <div class="metrics">
            {#each metrics as metric}<div>
                <div class="metric-top">
                  <strong>{metric.label}</strong><span
                    >{metric.value ?? "–"}<small>/10</small></span
                  >
                </div>
                <div class="track">
                  <span
                    style={`width:${Math.max(0, Math.min(10, metric.value ?? 0)) * 10}%`}
                    class:noise={metric.label === "Brus"}
                  ></span>
                </div>
                <small>{metric.note}</small>
              </div>{/each}
          </div>
          <div class="assessment-columns">
            {#each [{ title: "Styrkor", items: selected.strengths }, { title: "Svagheter", items: selected.weaknesses }, { title: "Förbättringar", items: selected.improvements }] as group}<div
              >
                <h3>{group.title}</h3>
                {#if group.items?.length}<ul>
                    {#each group.items as item}<li>{item}</li>{/each}
                  </ul>{:else}<p>
                    Inga uppgifter i den sparade bedömningen.
                  </p>{/if}
              </div>{/each}
          </div>
        {:else}<p class="unscored">
            <strong>Ingen kvalitetspoäng har satts.</strong>
            {contentMessage(selected)}
          </p>{/if}
        <div class="assessment-footer">
          <p>
            AI-genererad bedömning av den analyserade sidan. Nya resultat visas direkt för dig och granskas innan de delas i katalogen.
          </p>
          {#if publicUrl(selected.url)}<a
              class="primary"
              href={publicUrl(selected.url)}
              target="_blank"
              rel="noopener noreferrer">Besök sidan ↗</a
            >{/if}
        </div>
      {/if}
    </section>
  {/if}

  <section
    class="catalog"
    aria-labelledby="catalog-heading"
    aria-busy={loading}
  >
    <div class="section-top">
      <div>
        <span class="eyebrow">Den granskade katalogen</span>
        <h2 id="catalog-heading">
          {searched
            ? submittedQuery
              ? `Resultat för ”${submittedQuery}”`
              : "Alla matchande sidor"
            : "Några sidor att börja med"}
        </h2>
      </div>
      {#if searched}<button class="text-button" onclick={resetSearch}
          >Rensa sökning</button
        >{:else}<span class="catalog-caption"
          >Ett urval med höga kvalitetspoäng</span
        >{/if}
    </div>
    <div aria-live="polite" class="result-status">
      {#if loading}Laddar {searched
          ? "sökresultat"
          : "katalogen"}…{:else if !error && searched}{items.length}
        {items.length === 1 ? "träff" : "träffar"}{/if}
    </div>
    {#if loading}<div class="card-grid skeletons" aria-hidden="true">
        {#each [1, 2, 3] as n}<div class="skeleton">
            <span></span><i></i><i></i>
          </div>{/each}
      </div>
    {:else if error}<div class="empty">
        <h3>Det gick inte att hämta sidorna</h3>
        <p role="alert">{error}</p>
        <button
          class="secondary"
          onclick={() => (searched ? search() : loadCatalog())}
          >Försök igen</button
        >
      </div>
    {:else if items.length}<div class="card-grid">
        {#each items.slice(0, visibleCount) as item (item.id)}<PublicAnalysisCard
            {item}
            {apiBase}
            publicAssetBase={assetBase}
            oninspect={inspect}
          />{/each}
      </div>
      {#if items.length > visibleCount}<div class="load-more">
          <button class="secondary" onclick={() => (visibleCount += 9)}
            >Visa fler sidor</button
          ><span
            >Visar {Math.min(visibleCount, items.length)} av {items.length}</span
          >
        </div>{/if}
    {:else}<div class="empty">
        <span aria-hidden="true">⌕</span>
        <h3>
          {searched
            ? "Ingen granskad sida matchade din sökning"
            : "Katalogen väntar på sina första sidor"}
        </h3>
        <p>
          {searched
            ? "Prova ett annat ämne eller en bredare sökning. Katalogen innehåller bara sidor som har granskats för publicering."
            : "Du kan föreslå en sida som du tycker borde finnas här."}
        </p>
        {#if searched && queryAddress}
          <p>Adressen finns inte i den granskade katalogen ännu. En ny analys visas först här efter granskning.</p>
          <button class="primary" onclick={analyzeSearchAddress} disabled={busy}>Analysera {siteHost(queryAddress)}</button>
        {:else}<a href="#suggest">Föreslå en sida →</a>{/if}
      </div>{/if}
  </section>

  <section class="about" id="about" aria-labelledby="about-heading">
    <div>
      <span class="eyebrow">En poäng ska gå att förstå</span>
      <h2 id="about-heading">Vad gör en sida<br /> värd din tid?</h2>
      <p>
        Veridict använder AI för att analysera innehåll. Du får resultatet direkt. Granskningen avgör sedan om det ska delas i katalogen.
      </p>
      <p>
        Poängen är en vägledning, ingen garanti. Läs bedömningen för att se
        styrkor, svagheter och vilket syfte sidan har bedömts mot.
      </p>
    </div>
    <div class="principles">
      <div>
        <span>01</span>
        <div>
          <h3>Verkligt värde</h3>
          <p>Vad hjälper sidan dig att förstå eller göra?</p>
        </div>
      </div>
      <div>
        <span>02</span>
        <div>
          <h3>Tydligt innehåll</h3>
          <p>Är informationen relevant, begriplig och konkret?</p>
        </div>
      </div>
      <div>
        <span>03</span>
        <div>
          <h3>Mindre brus</h3>
          <p>Utfyllnad och låg nytta ska dra ner bedömningen.</p>
        </div>
      </div>
    </div>
  </section>

  <section class="suggest" id="suggest">
    <div>
      <span class="eyebrow">Hjälp katalogen att växa</span>
      <h2>Saknar du en sida?</h2>
      <p>
        Skriv en webbadress och få din bedömning direkt. Granskningen avgör sedan om den ska delas i katalogen för andra.
      </p>
    </div>
    <details bind:this={suggestPanel} open>
      <summary>Föreslå en sida <span aria-hidden="true">＋</span></summary>
      <form
        onsubmit={(event) => {
          event.preventDefault();
          submitSite();
        }}
      >
        <label for="suggest-url">Webbadress</label><input
          id="suggest-url"
          bind:value={url}
          type="text"
          inputmode="url"
          autocomplete="url"
          placeholder="https://example.com"
          required
          disabled={submitting}
        /><button
          class="primary"
          type="submit"
          disabled={busy || !url.trim()}
          >{submitting ? "Analyserar sidan…" : "Skicka för analys"}</button
        >
        <p class="form-note">
          Analysen kan ta en stund. Finns en sparad bedömning återanvänds den
          när det är möjligt.
        </p>
      </form>
      {#if submissionError}<p role="alert" class="error">
          {submissionError}
        </p>{/if}{#if submissionResult}<div
          class="submission-success"
          role="status"
        >
          <strong
            >{submissionResult.contentState === 'VerificationBlocked' ? 'Webbplatsen kunde inte läsas bakom verifieringen.' : submissionResult.contentState === 'InsufficientContent' ? 'Vi kunde inte läsa tillräckligt av sidan.' : submissionResult.alreadyApproved
              ? "Sidan finns redan i katalogen."
              : submissionResult.alreadyPending
                ? "Din sparade bedömning visas här och väntar på granskning för katalogen."
                : "Din bedömning är klar. Den inväntar granskning innan den delas i katalogen."}</strong
          >
          <p>
            {submissionResult.contentState &&
            submissionResult.contentState !== "Ready"
              ? contentMessage(submissionResult)
              : "Du kan läsa den sparade bedömningen här."}
          </p>
          {#if submissionResult.contentState && submissionResult.contentState !== 'Ready'}
            <p>Du kan försöka läsa sidan igen efter två minuter. Samma försök uppdateras utan att skapa dubbletter.</p>
            <button class="secondary" disabled={busy} onclick={() => submitSite(true)}>Försök läsa sidan igen</button>
          {/if}
          <button class="text-button" onclick={showSubmission}
            >Visa underlaget →</button
          >
        </div>{/if}
    </details>
  </section>
</main>
<footer class="site-footer">
  <a class="brand footer-brand" href="/">veridict.</a>
  <p>Innehåll som förtjänar din tid.</p>
  <a href="https://hildenmedia.se" target="_blank" rel="noopener noreferrer"
    >Ett projekt av Hilden Media ↗</a
  >
</footer>

<style>
  :global(*) {
    box-sizing: border-box;
  }
  :global(html) {
    scroll-behavior: smooth;
    scroll-padding-top: 24px;
    background: #121b19;
    color-scheme: dark;
    font-family:
      Inter,
      ui-sans-serif,
      system-ui,
      -apple-system,
      BlinkMacSystemFont,
      "Segoe UI",
      sans-serif;
    color: #e3ebe6;
  }
  :global(body) {
    margin: 0;
  }
  :global(button),
  :global(input),
  :global(select) {
    font: inherit;
  }
  :global(button),
  :global(a),
  :global(input),
  :global(select),
  :global(summary) {
    -webkit-tap-highlight-color: transparent;
  }
  :global(:focus-visible) {
    outline: 3px solid #9ac5ac;
    outline-offset: 4px;
  }
  :global(a) {
    color: #a8ceb8;
  }
  :global(button:disabled) {
    opacity: 0.6;
    cursor: wait;
  }
  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }
  .skip {
    position: fixed;
    top: 10px;
    left: 10px;
    padding: 12px;
    background: #18251f;
    z-index: 5;
    transform: translateY(-150%);
  }
  .skip:focus {
    transform: none;
  }
  .site-header {
    max-width: 1240px;
    margin: auto;
    padding: 27px 48px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 20px;
    border-bottom: 1px solid #30413a;
  }
  .brand {
    display: inline-flex;
    align-items: center;
    font-weight: 760;
    font-size: 1.65rem;
    letter-spacing: -1px;
    text-decoration: none;
    color: #c4ddcd;
  }
  .brand-mark {
    display: grid;
    place-items: center;
    background: #2d634b;
    color: #fff;
    width: 31px;
    height: 33px;
    border-radius: 10px 10px 13px 4px;
    font-size: 1.2rem;
    margin-right: 10px;
    font-family: Georgia, serif;
  }
  .brand-dot {
    color: #b58042;
  }
  .site-header nav {
    display: flex;
    gap: 30px;
    align-items: center;
  }
  .site-header nav a {
    text-decoration: none;
    color: #b7c8be;
    font-size: 0.82rem;
    font-weight: 550;
  }
  .site-header nav a:hover {
    color: #e9f4ed;
  }
  .site-header nav .suggest-link {
    border: 1px solid #435b50;
    padding: 10px 14px;
    border-radius: 7px;
  }
  main {
    max-width: 1240px;
    padding: 0 48px;
    margin: auto;
  }
  .hero {
    max-width: 850px;
    margin: 0 auto;
    text-align: center;
    padding: 48px 0 40px;
  }
  .eyebrow {
    font-size: 0.7rem;
    letter-spacing: 0.13em;
    text-transform: uppercase;
    font-weight: 700;
    color: #b1c3b5;
  }
  h1 {
    font-weight: 550;
    font-size: clamp(2.2rem, 4.5vw, 3.7rem);
    letter-spacing: -0.055em;
    line-height: 1.1;
    margin: 24px 0 20px;
  }
  h1 em {
    font-family: Georgia, serif;
    font-weight: 400;
    color: #9ec5ad;
  }
  .intro {
    color: #b4c6b9;
    font-size: 0.99rem;
    line-height: 1.8;
    margin: 0 0 32px;
  }
  .search-form {
    background: #1b2822;
    border: 1px solid #3c5146;
    border-radius: 14px;
    box-shadow: 0 7px 24px #25452e06;
    text-align: left;
    overflow: hidden;
  }
  .search-main {
    display: flex;
    align-items: center;
    padding: 10px 10px 10px 20px;
    gap: 12px;
  }
  .search-icon {
    color: #b1c3b5;
    font-size: 1.8rem;
  }
  .search-main input {
    border: 0;
    background: transparent;
    flex: 1;
    min-width: 0;
    padding: 14px 0;
    color: #e1ebe4;
    font-size: 0.9rem;
    outline-offset: 0;
  }
  .search-main input::placeholder {
    color: #b1c3b5;
  }
  .primary {
    display: inline-flex;
    justify-content: center;
    align-items: center;
    gap: 18px;
    min-height: 43px;
    border: 1px solid #2d6048;
    background: #2d6048;
    color: white;
    border-radius: 7px;
    padding: 11px 23px;
    font-size: 0.83rem;
    font-weight: 650;
    cursor: pointer;
    text-decoration: none;
    white-space: nowrap;
  }
  .primary:hover {
    background: #224d39;
  }
  .filters {
    padding: 12px 18px;
    background: #1c2924;
    border-top: 1px solid #33463b;
    display: flex;
    gap: 18px;
    align-items: center;
    flex-wrap: wrap;
  }
  .filters label {
    display: flex;
    gap: 7px;
    align-items: center;
    font-size: 0.69rem;
    color: #b1c3b5;
  }
  .filters select {
    color: #ceded1;
    background: transparent;
    border: 0;
    padding: 5px 3px;
    max-width: 180px;
    font-size: 0.72rem;
  }
  .filter-note {
    margin-left: auto;
    color: #b1c3b5;
    font-size: 0.65rem;
  }
  h2 {
    font-size: 1.65rem;
    letter-spacing: -0.035em;
    line-height: 1.25;
    font-weight: 550;
    margin: 8px 0 0;
  }
  .section-top {
    display: flex;
    justify-content: space-between;
    gap: 20px;
    align-items: center;
  }
  .catalog {
    padding: 15px 0 64px;
  }
  .catalog-caption {
    font-size: 0.73rem;
    color: #b1c3b5;
    align-self: end;
  }
  .result-status {
    min-height: 32px;
    padding: 8px 0;
    font-size: 0.75rem;
    color: #b1c3b5;
  }
  .card-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 23px;
  }
  .text-button {
    border: 0;
    background: none;
    color: #afd2bb;
    font-size: 0.77rem;
    padding: 6px 0;
    cursor: pointer;
    font-weight: 600;
  }
  .text-button:hover {
    text-decoration: underline;
  }
  .secondary {
    border: 1px solid #435e50;
    border-radius: 7px;
    padding: 11px 18px;
    background: #1b2822;
    color: #c1deca;
    font-size: 0.82rem;
    cursor: pointer;
  }
  .empty {
    text-align: center;
    background: #1b2822;
    border: 1px dashed #435c4d;
    border-radius: 14px;
    padding: 45px 25px;
  }
  .empty > span {
    font-size: 2.5rem;
  }
  .empty h3 {
    font-weight: 550;
  }
  .empty p {
    color: #b1c3b5;
    font-size: 0.88rem;
    max-width: 500px;
    margin: 15px auto;
    line-height: 1.7;
  }
  .empty a {
    font-size: 0.85rem;
  }
  .load-more {
    display: flex;
    align-items: center;
    flex-direction: column;
    gap: 12px;
    margin-top: 28px;
  }
  .load-more span {
    font-size: 0.7rem;
    color: #b1c3b5;
  }
  .skeleton {
    border: 1px solid #344a3d;
    border-radius: 18px;
    overflow: hidden;
    background: #1b2822;
    min-height: 350px;
  }
  .skeleton > span {
    display: block;
    aspect-ratio: 8/5;
    background: #26392e;
  }
  .skeleton i {
    display: block;
    height: 12px;
    background: #304536;
    margin: 22px;
    border-radius: 4px;
  }
  .skeleton i:last-child {
    width: 50%;
  }
  .assessment {
    border: 1px solid #3b5544;
    background: #1b2822;
    border-radius: 18px;
    margin: 0 0 36px;
    padding: 30px;
    scroll-margin-top: 30px;
  }
  .assessment h2 {
    overflow-wrap: anywhere;
  }
  .assessment h2:focus {
    outline: none;
  }
  .assessment-meta {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
    color: #b1c3b5;
    font-size: 0.72rem;
    margin: 14px 0;
  }
  .reviewed {
    color: #a8cdb5;
  }
  .pending {
    color: #dfc794;
  }
  .intent {
    font-size: 0.82rem;
    color: #b6c9ba;
    line-height: 1.6;
  }
  .assessment-summary {
    display: flex;
    align-items: center;
    gap: 30px;
    padding: 18px 0 28px;
  }
  .assessment-summary > p {
    margin: 0;
    color: #c3d4c6;
    line-height: 1.8;
    font-size: 0.95rem;
  }
  .total {
    display: flex;
    flex-direction: column;
    min-width: 110px;
    border-right: 1px solid #3a5140;
    padding-right: 25px;
  }
  .total strong {
    font-size: 3.2rem;
    letter-spacing: -0.07em;
    font-weight: 550;
    color: #b8d9c2;
  }
  .total span {
    font-size: 0.7rem;
    color: #b1c3b5;
  }
  .metrics {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 25px;
    padding: 24px 0;
    border-block: 1px solid #344a3c;
  }
  .metric-top {
    display: flex;
    justify-content: space-between;
    gap: 7px;
    font-size: 0.8rem;
  }
  .metric-top small {
    font-size: 0.65rem;
    color: #b1c3b5;
  }
  .metrics small {
    color: #b1c3b5;
    font-size: 0.67rem;
  }
  .track {
    height: 5px;
    background: #304638;
    border-radius: 4px;
    overflow: hidden;
    margin: 10px 0;
  }
  .track span {
    display: block;
    height: 100%;
    background: #92bc9b;
  }
  .track span.noise {
    background: #cfb47c;
  }
  .assessment-columns {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 30px;
    margin: 26px 0;
  }
  .assessment-columns h3 {
    font-size: 0.9rem;
    font-weight: 650;
  }
  .assessment-columns ul {
    padding-left: 17px;
  }
  .assessment-columns li,
  .assessment-columns p {
    color: #b5c9b9;
    font-size: 0.83rem;
    line-height: 1.8;
    margin-bottom: 9px;
  }
  .assessment-footer {
    display: flex;
    gap: 25px;
    align-items: center;
    border-top: 1px solid #344a3c;
    padding-top: 20px;
  }
  .assessment-footer p {
    color: #b1c3b5;
    font-size: 0.72rem;
    line-height: 1.7;
    margin: 0;
    flex: 1;
  }
  .unscored {
    background: #352f22;
    padding: 20px;
    color: #e2cfa5;
    line-height: 1.7;
  }
  .error {
    color: #f0acac;
    font-size: 0.85rem;
    line-height: 1.7;
  }
  .about {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 90px;
    border-top: 1px solid #34493a;
    padding: 53px 0;
  }
  .about h2 {
    font-size: 2.1rem;
  }
  .about > div > p,
  .suggest p {
    font-size: 0.85rem;
    color: #b4c7b6;
    line-height: 1.8;
    max-width: 430px;
  }
  .principles {
    display: grid;
    gap: 24px;
    padding: 5px 0;
  }
  .principles > div {
    display: flex;
    gap: 18px;
  }
  .principles > div > span {
    color: #b1c3b5;
    font-size: 0.72rem;
    padding-top: 4px;
  }
  .principles h3 {
    margin: 0 0 7px;
    font-size: 0.95rem;
    font-weight: 600;
  }
  .principles p {
    margin: 0;
    font-size: 0.83rem;
    color: #b1c3b5;
    line-height: 1.65;
  }
  .suggest {
    display: grid;
    grid-template-columns: 1.2fr 1fr;
    align-items: start;
    gap: 65px;
    border: 1px solid #354d3d;
    background: #1b2a22;
    border-radius: 16px;
    padding: 30px 35px;
    margin: 0 0 55px;
  }
  .suggest h2 {
    font-size: 1.5rem;
  }
  .suggest p {
    margin-bottom: 0;
  }
  .suggest details {
    background: #17231d;
    border: 1px solid #3c5442;
    border-radius: 9px;
    padding: 0 18px;
    margin-top: 6px;
  }
  .suggest summary {
    cursor: pointer;
    padding: 16px 0;
    color: #c2dfca;
    font-size: 0.85rem;
    font-weight: 600;
  }
  .suggest summary span {
    float: right;
  }
  .suggest form {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 10px 0 15px;
  }
  .suggest label {
    font-size: 0.75rem;
  }
  .suggest input {
    width: 100%;
    border: 1px solid #4d6b55;
    background: #18251f;
    border-radius: 6px;
    padding: 12px;
    font-size: 0.85rem;
  }
  .suggest .form-note {
    font-size: 0.7rem;
    margin: 0;
  }
  .submission-success {
    padding-bottom: 18px;
    font-size: 0.8rem;
    line-height: 1.7;
  }
  .submission-success p {
    font-size: 0.75rem;
    margin: 8px 0;
  }
  .site-footer {
    max-width: 1144px;
    margin: auto;
    border-top: 1px solid #344a3b;
    padding: 25px 0 35px;
    display: flex;
    align-items: center;
    gap: 25px;
  }
  .footer-brand {
    font-size: 1.25rem;
  }
  .site-footer p {
    font-size: 0.72rem;
    color: #b1c3b5;
  }
  .site-footer > a:last-child {
    font-size: 0.7rem;
    margin-left: auto;
    color: #b1c3b5;
    text-decoration: none;
  }
  @media (max-width: 900px) {
    .site-header {
      padding: 23px 25px;
    }
    main {
      padding: 0 25px;
    }
    .card-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
    .about {
      gap: 40px;
    }
    .suggest {
      gap: 30px;
      padding: 25px;
    }
    .filter-note {
      display: none;
    }
    .site-footer {
      margin: 0 25px;
    }
    .metrics {
      grid-template-columns: repeat(2, 1fr);
    }
    .assessment-columns {
      gap: 20px;
    }
    .hero {
      padding-top: 55px;
    }
    .site-header nav {
      gap: 18px;
    }
  }
  @media (max-width: 600px) {
    .site-header {
      padding: 20px;
      align-items: start;
    }
    .brand {
      font-size: 1.4rem;
    }
    .brand-mark {
      width: 27px;
      height: 29px;
    }
    .site-header nav {
      gap: 11px;
      flex-wrap: wrap;
      justify-content: end;
      max-width: 180px;
    }
    .site-header nav a {
      font-size: 0.7rem;
    }
    .site-header nav .suggest-link {
      padding: 5px 8px;
    }
    .site-header nav a:nth-child(2) {
      display: none;
    }
    main {
      padding: 0 20px;
    }
    .hero {
      padding: 42px 0 35px;
    }
    h1 {
      font-size: 2.65rem;
    }
    .intro {
      font-size: 0.84rem;
    }
    .intro br {
      display: none;
    }
    .search-main {
      padding: 8px;
      gap: 6px;
    }
    .search-icon {
      display: none;
    }
    .search-main input {
      font-size: 0.78rem;
      padding: 13px 5px;
    }
    .primary {
      padding: 11px 15px;
      gap: 10px;
    }
    .filters {
      padding: 10px;
      gap: 10px;
    }
    .filters label {
      display: block;
      font-size: 0.65rem;
    }
    .filters select {
      display: block;
      max-width: 155px;
      font-size: 0.7rem;
      padding: 6px 0;
    }
    .card-grid {
      grid-template-columns: 1fr;
    }
    .catalog {
      padding-bottom: 38px;
    }
    .section-top {
      align-items: start;
      gap: 14px;
    }
    .catalog-caption {
      display: none;
    }
    h2 {
      font-size: 1.4rem;
    }
    .eyebrow {
      font-size: 0.62rem;
    }
    .about {
      grid-template-columns: 1fr;
      gap: 25px;
      padding: 35px 0;
    }
    .about h2 {
      font-size: 1.8rem;
    }
    .about h2 br {
      display: none;
    }
    .suggest {
      grid-template-columns: 1fr;
      gap: 15px;
      padding: 23px;
      margin-bottom: 35px;
    }
    .assessment {
      padding: 22px;
    }
    .assessment-summary {
      gap: 18px;
      align-items: start;
    }
    .total {
      min-width: 80px;
      padding-right: 15px;
    }
    .total strong {
      font-size: 2.6rem;
    }
    .assessment-summary > p {
      font-size: 0.85rem;
    }
    .metrics {
      gap: 20px;
    }
    .assessment-columns {
      grid-template-columns: 1fr;
      gap: 5px;
    }
    .assessment-footer {
      flex-direction: column;
      align-items: start;
    }
    .site-footer {
      flex-wrap: wrap;
      gap: 10px;
      margin: 0 20px;
      padding: 23px 0;
    }
    .site-footer p {
      margin-left: auto;
      font-size: 0.65rem;
    }
    .site-footer > a:last-child {
      flex-basis: 100%;
      margin: 0;
      font-size: 0.65rem;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    :global(html) {
      scroll-behavior: auto;
    }
  }
  .active-progress { margin-top: 16px; }
  @media (max-width: 380px) { .filters { grid-template-columns: 1fr; } }
  @media (max-width: 600px) {
    .site-header { padding: 16px; align-items: center; }
    .site-header nav { max-width: none; gap: 14px; }
    .site-header nav a:first-child { display: none; }
    main { padding: 0 16px; }
    .hero { padding: 28px 0 24px; text-align: left; }
    h1 { font-size: clamp(2rem, 9vw, 2.6rem); margin: 10px 0 14px; }
    .desktop-break { display: none; }
    .intro { font-size: .9rem; line-height: 1.6; margin-bottom: 22px; }
    .search-main { display: grid; grid-template-columns: 1fr; padding: 10px; gap: 8px; }
    .search-main input { font-size: 1rem; padding: 13px 10px; min-height: 48px; width: 100%; }
    .search-main > button { min-height: 48px; width: 100%; font-size: .95rem; }
    .filters { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; padding: 12px; }
    .filters label { min-width: 0; font-size: .75rem; }
    .filters select { max-width: 100%; width: 100%; font-size: .85rem; min-height: 38px; }
    .suggest { padding: 20px; }
    .assessment-summary { flex-direction: column; }
    .total { border-right: 0; }
    .metrics { grid-template-columns: 1fr; }
    .assessment { padding: 18px; }
  }
</style>
