<script lang="ts">
	import { onMount } from "svelte";
	import {
		getApiEnvironmentConfig,
		getReviewApiToken,
		getStoredApiEnvironmentMode,
		isInternalReviewEnabledForCurrentBrowser,
		resolveScreenshotUrl,
		setStoredApiEnvironmentMode,
		type ApiEnvironmentMode,
	} from "$lib/apiEnvironment";

	type ReviewStatus = "PendingReview" | "Approved" | "Rejected" | "Superseded";

	type ReviewAnalysis = {
		id: string;
		siteTitle?: string;
		url?: string;
		canonicalUrl?: string;
		screenshotPath?: string;
		screenshotThumbnailPath?: string;
		category?: string;
		score?: number;
		status?: ReviewStatus | string;
		contentState?: string;
		contentStateReason?: string;
		summary?: string;
		createdAt?: string;
		lastAnalyzedAt?: string;
		pendingDuplicateCount?: number;
		hasPendingDuplicates?: boolean;
		alreadyApprovedInProduction?: boolean;
		replacementTargetId?: string;
		replacementTargetTitle?: string;
		replacementTargetUrl?: string;
		replacementTargetCategory?: string;
		replacementTargetScore?: number;
		replacementTargetCreatedAt?: string;
		replacementTargetLastAnalyzedAt?: string;
	};

	type ScreenshotRefreshResponse = {
		success: boolean;
		message?: string;
		failureReason?: string;
		failureStage?: string;
		analysis?: ReviewAnalysis;
	};

	type Tab = "pending" | "approved" | "rejected";

	let analyses = $state<ReviewAnalysis[]>([]);
	let apiMode = $state<ApiEnvironmentMode>("production");
	let activeTab = $state<Tab>("pending");
	let query = $state("");
	let loading = $state(true);
	let reviewAllowed = $state(false);
	let actionId = $state<string | null>(null);
	let error = $state("");
	let imageFailures = $state<string[]>([]);
	let screenshotFailureReasons = $state<Record<string, string>>({});
	let queryInput = $state<HTMLInputElement | undefined>(undefined);

	const pendingCount = $derived(countByStatus("PendingReview"));
	const approvedCount = $derived(countByStatus("Approved"));
	const rejectedCount = $derived(countByStatus("Rejected") + countByStatus("Superseded"));
	const activeEnvironment = $derived(getApiEnvironmentConfig(apiMode));
	const filteredAnalyses = $derived(
		analyses
			.filter((analysis) => tabMatches(analysis, activeTab))
			.filter(matchesQuery)
			.sort(
				(a, b) =>
					new Date(b.createdAt ?? 0).getTime() -
					new Date(a.createdAt ?? 0).getTime(),
			),
	);

	const tabs: { id: Tab; label: string }[] = [
		{ id: "pending", label: "Väntande" },
		{ id: "approved", label: "Godkända" },
		{ id: "rejected", label: "Avvisade" },
	];

	onMount(() => {
		apiMode = getStoredApiEnvironmentMode();
		reviewAllowed = isInternalReviewEnabledForCurrentBrowser();

		if (reviewAllowed) {
			loadAnalyses();
		} else {
			loading = false;
		}
	});

	async function loadAnalyses() {
		loading = true;
		error = "";

		try {
			const [pending, approved, rejected] = await Promise.all([
				fetchAnalyses("pending"),
				fetchAnalyses("approved"),
				fetchOptionalAnalyses("rejected"),
			]);

			analyses = mergeAnalyses([...pending, ...approved, ...rejected]);
		} catch (err) {
			error =
				errorFromUnknown(err) ||
				"Kunde inte hämta granskningskön. Kontrollera API-adressen och din åtkomstnyckel.";
		} finally {
			loading = false;
		}
	}

	function clearQuery() {
		query = "";
		queryInput?.focus();
	}

	async function selectApiMode(mode: ApiEnvironmentMode) {
		if (mode === apiMode || actionId) return;

		apiMode = mode;
		setStoredApiEnvironmentMode(mode);
		analyses = [];
		imageFailures = [];
		screenshotFailureReasons = {};
		await loadAnalyses();
	}

	async function fetchAnalyses(status: Tab) {
		const response = await reviewFetch(`/internal/review/analyses/${status}`);

		if (!response.ok) {
			throw new Error(await readErrorMessage(response));
		}

		return (await response.json()) as ReviewAnalysis[];
	}

	async function fetchOptionalAnalyses(status: Tab) {
		try {
			return await fetchAnalyses(status);
		} catch {
			return [] as ReviewAnalysis[];
		}
	}

	type ReviewAction =
		| "approve"
		| "reject"
		| "reanalyze"
		| "remove-from-catalog"
		| "restore-to-pending"
		| "delete";

	async function reviewAction(id: string, action: ReviewAction) {
		if (actionId) return;

		actionId = id;
		error = "";

		try {
			const path = `/internal/review/analyses/${id}/${action}`;
			const response = await reviewFetch(path, {
				method: "POST",
			});

			if (!response.ok) {
				throw new Error(await readErrorMessage(response));
			}

			if (action === "delete") {
				analyses = analyses.filter((analysis) => analysis.id !== id);
				return;
			}

			const updated = (await response.json()) as ReviewAnalysis;

			if (action === "approve" || action === "restore-to-pending" || action === "reanalyze") {
				await loadAnalyses();
			} else {
				analyses = mergeAnalyses([
					...analyses.filter((analysis) => analysis.id !== updated.id),
					updated,
				]);
			}
		} catch (err) {
			error = `Kunde inte ${reviewActionLabel(action)} bedömningen. ${errorFromUnknown(err)}`;
		} finally {
			actionId = null;
		}
	}

	function reviewActionLabel(action: ReviewAction) {
		if (action === "remove-from-catalog") return "ta bort från katalogen";
		if (action === "restore-to-pending") return "återställa till granskning";
		if (action === "reanalyze") return "analysera om";
		if (action === "delete") return "radera";
		return action === "approve" ? "godkänna" : "avvisa";
	}

	async function refreshScreenshot(id: string) {
		if (actionId) return;

		actionId = id;
		error = "";

		try {
			const response = await reviewFetch(`/internal/review/analyses/${id}/refresh-screenshot`, {
				method: "POST",
			});

			if (!response.ok) {
				throw new Error(`Bildhämtningen gav status ${response.status}`);
			}

			const payload = (await response.json()) as ScreenshotRefreshResponse;

			if (!payload.analysis) {
				throw new Error(payload.message || "Bilden kunde inte uppdateras.");
			}

			if (!payload.success) {
				const reason = [payload.failureStage, payload.failureReason]
					.filter(Boolean)
					.join(": ");

				screenshotFailureReasons = {
					...screenshotFailureReasons,
					[payload.analysis.id]: reason || payload.message || "Bilden kunde inte uppdateras.",
				};

				analyses = mergeAnalyses([
					...analyses.filter((analysis) => analysis.id !== payload.analysis!.id),
					payload.analysis,
				]);
				await loadAnalyses();

				return;
			}

			imageFailures = imageFailures.filter((failedId) => failedId !== payload.analysis!.id);
			const { [payload.analysis.id]: _removed, ...remainingFailureReasons } = screenshotFailureReasons;
			screenshotFailureReasons = remainingFailureReasons;
			analyses = mergeAnalyses([
				...analyses.filter((analysis) => analysis.id !== payload.analysis!.id),
				payload.analysis,
			]);
			await loadAnalyses();
		} catch {
			error = "Kunde inte uppdatera bilden. Mer information finns i serverloggen.";
		} finally {
			actionId = null;
		}
	}

	function mergeAnalyses(items: ReviewAnalysis[]) {
		const byId = new Map<string, ReviewAnalysis>();

		for (const item of items) {
			byId.set(item.id, item);
		}

		return Array.from(byId.values());
	}

	function countByStatus(status: ReviewStatus) {
		return analyses.filter((analysis) => normalizeStatus(analysis.status) === status)
			.length;
	}

	function tabMatches(analysis: ReviewAnalysis, tab: Tab) {
		const status = normalizeStatus(analysis.status);

		if (tab === "pending") return status === "PendingReview";
		if (tab === "approved") return status === "Approved";
		return status === "Rejected" || status === "Superseded";
	}

	function matchesQuery(analysis: ReviewAnalysis) {
		const trimmed = query.trim().toLowerCase();
		if (!trimmed) return true;

		return [
			analysis.siteTitle,
			analysis.url,
			analysis.category,
			analysis.summary,
		]
			.filter(Boolean)
			.join(" ")
			.toLowerCase()
			.includes(trimmed);
	}

	function normalizeStatus(status?: string): ReviewStatus {
		if (status === "Approved") return "Approved";
		if (status === "Rejected") return "Rejected";
		if (status === "Superseded") return "Superseded";
		return "PendingReview";
	}

	function statusLabel(status?: string) {
		const normalized = normalizeStatus(status);
		return ({ PendingReview: "Väntar på granskning", Approved: "Godkänd", Rejected: "Avvisad", Superseded: "Ersatt" })[normalized];
	}

	function formatScore(score?: number) {
		return typeof score === "number" ? score.toFixed(1) : "--";
	}

	function scoreTone(score?: number) {
		if (typeof score !== "number") return "unknown";
		if (score >= 8) return "strong";
		if (score >= 6) return "good";
		if (score >= 4) return "watch";
		return "low";
	}

	function isVerificationBlocked(analysis: ReviewAnalysis) {
		return analysis.contentState === "VerificationBlocked" || analysis.contentState === "InsufficientContent";
	}

	function formatDate(value?: string) {
		if (!value) return "Okänt";

		const date = new Date(value);
		if (Number.isNaN(date.getTime())) return "Okänt";

		return new Intl.DateTimeFormat("sv-SE", {
			month: "short",
			day: "numeric",
			year: "numeric",
			hour: "2-digit",
			minute: "2-digit",
		}).format(date);
	}

	function analysisTimestamp(analysis: ReviewAnalysis) {
		return analysis.lastAnalyzedAt || analysis.createdAt;
	}

	function hasSeparateCreatedAt(analysis: ReviewAnalysis) {
		if (!analysis.lastAnalyzedAt || !analysis.createdAt) return false;

		const analyzedAt = new Date(analysis.lastAnalyzedAt).getTime();
		const createdAt = new Date(analysis.createdAt).getTime();

		if (Number.isNaN(analyzedAt) || Number.isNaN(createdAt)) return false;

		return analyzedAt !== createdAt;
	}

	function formatHost(value?: string) {
		if (!value) return "";

		try {
			return new URL(value).hostname.replace(/^www\./, "");
		} catch {
			return value.replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0];
		}
	}

	function replacementAnalysisFor(analysis: ReviewAnalysis) {
		if (!analysis.replacementTargetId) return null;
		return (
			analyses.find((candidate) => candidate.id === analysis.replacementTargetId) ??
			null
		);
	}

	function replacementTitle(analysis: ReviewAnalysis) {
		const target = replacementAnalysisFor(analysis);
		return (
			analysis.replacementTargetTitle ||
			target?.siteTitle ||
			formatHost(analysis.replacementTargetUrl || target?.url) ||
			"Godkänd sida"
		);
	}

	function replacementScore(analysis: ReviewAnalysis) {
		const target = replacementAnalysisFor(analysis);
		return typeof analysis.replacementTargetScore === "number"
			? analysis.replacementTargetScore
			: target?.score;
	}

	function replacementCategory(analysis: ReviewAnalysis) {
		const target = replacementAnalysisFor(analysis);
		return analysis.replacementTargetCategory || target?.category || "Utan kategori";
	}

	function replacementCreatedAt(analysis: ReviewAnalysis) {
		const target = replacementAnalysisFor(analysis);
		return analysis.replacementTargetCreatedAt || target?.createdAt;
	}

	function replacementTimestamp(analysis: ReviewAnalysis) {
		const target = replacementAnalysisFor(analysis);
		return (
			analysis.replacementTargetLastAnalyzedAt ||
			target?.lastAnalyzedAt ||
			replacementCreatedAt(analysis)
		);
	}

	function screenshotSource(analysis: ReviewAnalysis) {
		if (imageFailures.includes(analysis.id)) return "";

		const reference =
			analysis.screenshotThumbnailPath || analysis.screenshotPath || "";

		if (!reference.trim()) return "";

		return resolveScreenshotUrl(reference, activeEnvironment);
	}

	function markImageFailed(id: string) {
		if (!imageFailures.includes(id)) {
			imageFailures = [...imageFailures, id];
		}
	}

	function screenshotFailureReason(id: string) {
		return screenshotFailureReasons[id] || "";
	}

	async function reviewFetch(path: string, init: RequestInit = {}) {
		const headers = new Headers(init.headers);
		const reviewToken = getReviewApiToken().trim();

		if (reviewToken) {
			headers.set("X-Veridict-Review-Token", reviewToken);
		}

		headers.set("Accept", "application/json");

		return fetch(`${activeEnvironment.apiBaseUrl}${path}`, {
			...init,
			headers,
		});
	}

	async function readErrorMessage(response: Response) {
		try {
			const payload = await response.json();
			return (
				payload.error ||
				payload.message ||
				payload.detail ||
				payload.title ||
				`Gransknings-API:et gav status ${response.status}`
			);
		} catch {
			return `Gransknings-API:et gav status ${response.status}`;
		}
	}

	function errorFromUnknown(value: unknown) {
		return value instanceof Error && value.message ? value.message : "";
	}

</script>

<svelte:head>
	<title>Veridicts granskningskö</title>
	<meta
		name="description"
		content="Intern granskning av Veridicts AI-genererade bedömningar."
	/>
</svelte:head>

<main class="review-shell">
	{#if !reviewAllowed}
		<section class="access-panel">
			<span class="mark"><i></i><b></b></span>
			<div>
				<p>Internt verktyg</p>
				<h1>Granskningen är inte tillgänglig här</h1>
				<span>
					Granskningsverktyget kräver en lokal utvecklingsmiljö eller en aktiverad
					intern miljö.
				</span>
			</div>
		</section>
	{:else}
	<header class="topbar">
		<div class="brand-block">
			<a href="/" aria-label="Till Veridicts startsida">
				<span class="mark"><i></i><b></b></span>
			</a>
			<div>
				<p>Intern granskning</p>
				<h1>Veridicts granskningskö</h1>
				<span class="api-source">{activeEnvironment.label}: {activeEnvironment.apiBaseUrl}</span>
			</div>
		</div>

		<div class="topbar-tools">
			<div class="environment-control" data-mode={apiMode}>
				<span class="environment-badge">{activeEnvironment.label}</span>
				<div class="environment-switch" aria-label="Miljö för gransknings-API">
					<button
						class:active={apiMode === "local"}
						disabled={loading || Boolean(actionId)}
						onclick={() => selectApiMode("local")}
						type="button"
					>
						Lokalt
					</button>
					<button
						class:active={apiMode === "production"}
						disabled={loading || Boolean(actionId)}
						onclick={() => selectApiMode("production")}
						type="button"
					>
						Publicerad
					</button>
				</div>
				<a href={activeEnvironment.publicCatalogUrl} target="_blank" rel="noreferrer">
					Öppna katalogen
				</a>
			</div>

			<div class="counters" aria-label="Antal per granskningsstatus">
				<button
					class:active={activeTab === "pending"}
					onclick={() => (activeTab = "pending")}
					type="button"
				>
					<span>Väntande</span>
					<strong>{pendingCount}</strong>
				</button>
				<button
					class:active={activeTab === "approved"}
					onclick={() => (activeTab = "approved")}
					type="button"
				>
					<span>Godkända</span>
					<strong>{approvedCount}</strong>
				</button>
				<button
					class:active={activeTab === "rejected"}
					onclick={() => (activeTab = "rejected")}
					type="button"
				>
					<span>Avvisade</span>
					<strong>{rejectedCount}</strong>
				</button>
			</div>
		</div>
	</header>

	<section class="controls" aria-label="Granskningsval">
		<label class="search-field">
			<span>Sök</span>
			<input
				bind:this={queryInput}
				bind:value={query}
				placeholder="Filtrera på titel, webbadress, kategori eller sammanfattning"
				type="search"
			/>
			{#if query}
				<button
					aria-label="Rensa filtret"
					class="input-clear"
					onclick={clearQuery}
					type="button"
				>
					&times;
				</button>
			{/if}
		</label>

		<nav class="tabs" aria-label="Granskningsstatus">
			{#each tabs as tab}
				<button
					class:active={activeTab === tab.id}
					onclick={() => (activeTab = tab.id)}
					type="button"
				>
					{tab.label}
				</button>
			{/each}
		</nav>
	</section>

	{#if error}
		<section class="notice error" role="alert">
			<span>!</span>
			<p>{error}</p>
			<button onclick={loadAnalyses} type="button">Försök igen</button>
		</section>
	{/if}

	<section class="queue-panel" aria-live="polite">
		<div class="panel-heading">
			<div>
				<span>{statusLabel(activeTab === "pending" ? "PendingReview" : activeTab === "approved" ? "Approved" : "Rejected")}</span>
				<strong>{filteredAnalyses.length} bedömningar</strong>
			</div>
			<button onclick={loadAnalyses} disabled={loading} type="button">
				{loading ? "Uppdaterar" : "Uppdatera"}
			</button>
		</div>

		{#if loading}
			<div class="skeleton-list" aria-hidden="true">
				{#each Array(4) as _}
					<div></div>
				{/each}
			</div>
		{:else if filteredAnalyses.length}
			<div class="analysis-list">
				{#each filteredAnalyses as analysis}
					<article class="analysis-row">
							<div class="thumbnail">
								{#if screenshotSource(analysis)}
									<img
									src={screenshotSource(analysis)}
									alt={`Skärmbild av ${analysis.siteTitle || analysis.url || "sidan"}`}
									onerror={() => markImageFailed(analysis.id)}
								/>
								{:else}
									<div class="thumbnail-placeholder">
										<span>WEBP</span>
										<strong>{imageFailures.includes(analysis.id) ? "Bilden kan inte visas" : "Ingen bild"}</strong>
									</div>
								{/if}
							</div>

						<div class="analysis-main">
							<div class="analysis-topline">
								<div class="site-copy">
									<h2>{analysis.siteTitle || "Sida utan titel"}</h2>
									<a href={analysis.url} target="_blank" rel="noreferrer">
										{analysis.url}
									</a>
								</div>

								<div class="badges">
									<span class="score-badge" data-tone={scoreTone(analysis.score)}
										>{isVerificationBlocked(analysis) ? "Kan inte bedömas" : formatScore(analysis.score)}</span
									>
									<span class="status-badge" data-status={normalizeStatus(analysis.status)}
										>{statusLabel(analysis.status)}</span
									>
								</div>
							</div>

							{#if isVerificationBlocked(analysis)}
								<div class="content-warning">
									<span>Innehållet kunde inte läsas</span>
									<p>
										{analysis.contentStateReason || "Innehållet kunde inte läsas eller blockerades av en säkerhetskontroll. Analysera igen senare eller avvisa. Sidan kan godkännas när innehållet går att bedöma."}
									</p>
								</div>
							{/if}

							<div class="meta-line">
								<span>{analysis.category || "Utan kategori"}</span>
								<i></i>
								<span>Analyserad {formatDate(analysisTimestamp(analysis))}</span>
								{#if hasSeparateCreatedAt(analysis)}
									<i></i>
									<span>Skapad {formatDate(analysis.createdAt)}</span>
								{/if}
							</div>

							{#if analysis.hasPendingDuplicates || analysis.alreadyApprovedInProduction || analysis.replacementTargetId}
								<div class="queue-flags">
									{#if analysis.hasPendingDuplicates}
										<span>{analysis.pendingDuplicateCount} väntande dubbletter</span>
									{/if}
									{#if analysis.alreadyApprovedInProduction}
										<span>Godkänd i den publicerade katalogen</span>
									{/if}
									{#if analysis.replacementTargetId}
										<span>Ersätter {analysis.replacementTargetTitle || "godkänd sida"}</span>
									{/if}
								</div>
							{/if}

							{#if normalizeStatus(analysis.status) === "PendingReview" && analysis.replacementTargetId}
								<div class="replacement-comparison">
                                    <span>Ersätter godkänd bedömning</span>
									<p>
										<strong>{replacementTitle(analysis)}</strong>
										<em>Poäng {formatScore(replacementScore(analysis))}</em>
										<em>{replacementCategory(analysis)}</em>
										{#if replacementTimestamp(analysis)}
											<em>{formatDate(replacementTimestamp(analysis))}</em>
										{/if}
									</p>
								</div>
							{/if}

							{#if screenshotFailureReason(analysis.id)}
								<div class="screenshot-failure">
									<span>Bilden kunde inte hämtas</span>
									<p>{screenshotFailureReason(analysis.id)}</p>
								</div>
							{/if}

							<p class="summary">{analysis.summary || "Ingen sammanfattning."}</p>
						</div>

						<div class="actions">
							<button
								class="refresh"
								disabled={actionId === analysis.id}
								onclick={() => refreshScreenshot(analysis.id)}
								type="button"
							>
								Uppdatera bild
							</button>

							{#if normalizeStatus(analysis.status) === "PendingReview"}
								<button
									class="reanalyze"
									disabled={actionId === analysis.id}
									onclick={() => reviewAction(analysis.id, "reanalyze")}
									type="button"
								>
									Analysera igen
								</button>
								<button
									class="approve"
									disabled={actionId === analysis.id || isVerificationBlocked(analysis)}
									onclick={() => reviewAction(analysis.id, "approve")}
									type="button"
								>
									Godkänn
								</button>
								<button
									class="reject"
									disabled={actionId === analysis.id}
									onclick={() => reviewAction(analysis.id, "reject")}
									type="button"
								>
									Avvisa
								</button>
							{/if}

							{#if normalizeStatus(analysis.status) === "Approved"}
								<button
									class="remove"
									disabled={actionId === analysis.id}
									onclick={() => reviewAction(analysis.id, "remove-from-catalog")}
									type="button"
								>
									Ta bort från katalogen
								</button>
							{/if}

							{#if normalizeStatus(analysis.status) === "Rejected"}
								<button
									class="restore"
									disabled={actionId === analysis.id}
									onclick={() => reviewAction(analysis.id, "restore-to-pending")}
									type="button"
								>
									Återställ till granskning
								</button>
								<button
									class="delete"
									disabled={actionId === analysis.id}
									onclick={() => reviewAction(analysis.id, "delete")}
									type="button"
								>
									Radera bedömning
								</button>
							{/if}
						</div>
					</article>
				{/each}
			</div>
		{:else}
			<div class="empty-state">
				<strong>Inga {tabs.find((tab) => tab.id === activeTab)?.label.toLowerCase()} bedömningar</strong>
				<p>{activeTab === "pending" ? "Inga bedömningar väntar på granskning." : "Inga bedömningar matchar det här valet."}</p>
			</div>
		{/if}
	</section>
	{/if}
</main>

<style>
	:global(*) {
		box-sizing: border-box;
	}

	:global(html) {
		min-width: 320px;
		background: #070d16;
		color-scheme: dark;
		font-family:
			Inter,
			ui-sans-serif,
			system-ui,
			-apple-system,
			BlinkMacSystemFont,
			"Segoe UI",
			sans-serif;
	}

	:global(body) {
		min-height: 100vh;
		margin: 0;
		background:
			linear-gradient(180deg, rgba(8, 18, 31, 0.98), rgba(5, 10, 18, 1)),
			#070d16;
		color: #eef4ff;
	}

	:global(button),
	:global(input) {
		font: inherit;
	}

	.review-shell {
		display: grid;
		gap: 18px;
		min-height: 100vh;
		padding: 92px clamp(16px, 3vw, 34px) 34px;
	}

	.access-panel {
		display: grid;
		grid-template-columns: 48px minmax(0, 520px);
		gap: 18px;
		align-items: start;
		justify-content: center;
		margin: auto;
		padding: 26px;
		border: 1px solid rgba(124, 146, 180, 0.16);
		border-radius: 8px;
		background: #08111d;
		box-shadow: 0 20px 55px rgba(0, 0, 0, 0.24);
	}

	.access-panel p {
		margin: 0 0 4px;
		color: #8291aa;
		font-size: 0.78rem;
		font-weight: 800;
		text-transform: uppercase;
	}

	.access-panel span:not(.mark) {
		display: block;
		margin-top: 10px;
		color: #a7b6cc;
		line-height: 1.55;
	}

	.topbar {
		position: fixed;
		inset: 0 0 auto;
		z-index: 20;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 20px;
		min-height: 72px;
		padding: 12px clamp(16px, 3vw, 34px);
		border-bottom: 1px solid rgba(124, 146, 180, 0.18);
		background: rgba(5, 12, 21, 0.92);
		backdrop-filter: blur(18px);
	}

	.brand-block {
		display: flex;
		align-items: center;
		gap: 14px;
		min-width: 0;
	}

	.brand-block a {
		display: grid;
		flex: 0 0 38px;
		width: 38px;
		height: 38px;
		place-items: center;
		border: 1px solid rgba(122, 149, 190, 0.24);
		border-radius: 8px;
		background: #0c1726;
	}

	.mark {
		position: relative;
		display: inline-flex;
		width: 24px;
		height: 25px;
	}

	.mark i,
	.mark b {
		position: absolute;
		bottom: 0;
		width: 10px;
		border-radius: 3px;
		transform-origin: bottom;
	}

	.mark i {
		left: 4px;
		height: 24px;
		background: linear-gradient(180deg, #8f62ff, #2e92ff);
		transform: skew(20deg);
	}

	.mark b {
		right: 4px;
		height: 20px;
		background: linear-gradient(180deg, #52f1c8, #4b8cff);
		transform: skew(-22deg);
	}

	.brand-block p {
		margin: 0 0 2px;
		color: #8291aa;
		font-size: 0.78rem;
		font-weight: 800;
		text-transform: uppercase;
	}

	.api-source {
		display: block;
		overflow: hidden;
		max-width: min(54vw, 620px);
		color: #607088;
		font-size: 0.72rem;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	h1 {
		margin: 0;
		color: #ffffff;
		font-size: clamp(1.1rem, 2vw, 1.45rem);
		line-height: 1.1;
		letter-spacing: 0;
	}

	.topbar-tools {
		display: flex;
		align-items: center;
		gap: 14px;
	}

	.environment-control {
		display: grid;
		grid-template-columns: auto auto auto;
		align-items: center;
		gap: 8px;
		padding: 6px;
		border: 1px solid rgba(124, 146, 180, 0.16);
		border-radius: 9px;
		background: rgba(8, 18, 31, 0.72);
	}

	.environment-badge {
		min-height: 30px;
		border: 1px solid rgba(84, 220, 170, 0.28);
		border-radius: 7px;
		background: rgba(38, 203, 145, 0.1);
		color: #72edc1;
		padding: 7px 10px;
		font-size: 0.72rem;
		font-weight: 900;
		text-transform: uppercase;
		white-space: nowrap;
	}

	.environment-control[data-mode="production"] .environment-badge {
		border-color: rgba(255, 151, 72, 0.36);
		background: rgba(255, 116, 72, 0.12);
		color: #ffb06d;
	}

	.environment-switch {
		display: grid;
		grid-template-columns: repeat(2, auto);
		gap: 3px;
		padding: 3px;
		border: 1px solid rgba(124, 146, 180, 0.16);
		border-radius: 8px;
		background: #07111d;
	}

	.environment-switch button {
		min-height: 30px;
		border: 0;
		border-radius: 6px;
		background: transparent;
		color: #94a4bd;
		cursor: pointer;
		padding: 0 10px;
		font-size: 0.76rem;
		font-weight: 850;
	}

	.environment-switch button.active {
		background: rgba(52, 212, 156, 0.16);
		color: #a8f9dc;
	}

	.environment-control[data-mode="production"] .environment-switch button.active {
		background: rgba(255, 116, 72, 0.16);
		color: #ffc08b;
	}

	.environment-switch button:disabled {
		cursor: wait;
		opacity: 0.62;
	}

	.environment-control a {
		min-height: 30px;
		border: 1px solid rgba(124, 146, 180, 0.18);
		border-radius: 7px;
		color: #cbd8eb;
		padding: 7px 10px;
		font-size: 0.76rem;
		font-weight: 800;
		text-decoration: none;
		white-space: nowrap;
	}

	.environment-control a:hover {
		border-color: rgba(143, 178, 255, 0.42);
		color: #ffffff;
	}

	.counters {
		display: flex;
		gap: 8px;
	}

	.counters button,
	.tabs button,
	.panel-heading button,
	.notice button,
	.actions button {
		border: 1px solid rgba(124, 146, 180, 0.2);
		border-radius: 7px;
		background: #0b1523;
		color: #dce7f8;
		cursor: pointer;
	}

	.counters button {
		display: grid;
		grid-template-columns: auto auto;
		align-items: center;
		gap: 10px;
		min-height: 42px;
		padding: 0 12px;
	}

	.counters span {
		color: #9aaac2;
		font-size: 0.78rem;
		font-weight: 750;
		text-transform: uppercase;
	}

	.counters strong {
		color: #ffffff;
		font-size: 1.05rem;
	}

	.counters button.active,
	.tabs button.active {
		border-color: rgba(98, 143, 255, 0.6);
		background: linear-gradient(180deg, #10243d, #0b192a);
		box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04);
	}

	.controls {
		display: grid;
		grid-template-columns: minmax(240px, 1fr) auto;
		gap: 14px;
		align-items: end;
	}

	.search-field {
		position: relative;
		display: grid;
		gap: 8px;
	}

	.search-field span {
		color: #8e9db4;
		font-size: 0.78rem;
		font-weight: 800;
		text-transform: uppercase;
	}

	input {
		width: 100%;
		min-height: 46px;
		border: 1px solid rgba(124, 146, 180, 0.22);
		border-radius: 8px;
		outline: 0;
		background: #091321;
		color: #ffffff;
		padding: 0 14px;
	}

	.search-field input {
		padding-right: 48px;
	}

	input:focus {
		border-color: rgba(93, 136, 255, 0.72);
		box-shadow: 0 0 0 4px rgba(75, 100, 255, 0.12);
	}

	input::placeholder {
		color: #718096;
	}

	input[type="search"]::-webkit-search-cancel-button {
		appearance: none;
	}

	.search-field .input-clear {
		position: absolute;
		right: 7px;
		bottom: 6px;
		display: grid;
		width: 34px;
		height: 34px;
		place-items: center;
		border: 1px solid rgba(124, 146, 180, 0.18);
		border-radius: 999px;
		background: rgba(15, 28, 45, 0.78);
		color: #8fa0ba;
		cursor: pointer;
		font-size: 1.08rem;
		font-weight: 850;
		line-height: 1;
		padding: 0;
		transition:
			background 160ms ease,
			border-color 160ms ease,
			color 160ms ease,
			transform 160ms ease;
	}

	.search-field .input-clear:hover,
	.search-field .input-clear:focus-visible {
		border-color: rgba(111, 152, 255, 0.5);
		background: rgba(32, 52, 82, 0.92);
		color: #ffffff;
		outline: 0;
		transform: scale(1.03);
	}

	.tabs {
		display: flex;
		gap: 8px;
		padding: 4px;
		border: 1px solid rgba(124, 146, 180, 0.14);
		border-radius: 10px;
		background: rgba(6, 13, 23, 0.72);
	}

	.tabs button {
		min-height: 38px;
		padding: 0 14px;
		font-weight: 750;
	}

	.notice,
	.queue-panel {
		border: 1px solid rgba(124, 146, 180, 0.16);
		border-radius: 8px;
		background: #08111d;
		box-shadow: 0 20px 55px rgba(0, 0, 0, 0.24);
	}

	.notice {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 14px 16px;
	}

	.notice span {
		display: grid;
		flex: 0 0 26px;
		width: 26px;
		height: 26px;
		place-items: center;
		border-radius: 50%;
		background: rgba(255, 75, 97, 0.12);
		color: #ff8290;
		font-weight: 900;
	}

	.notice p {
		flex: 1;
		margin: 0;
		color: #f1bcc5;
	}

	.notice button,
	.panel-heading button {
		min-height: 34px;
		padding: 0 12px;
	}

	.queue-panel {
		overflow: hidden;
	}

	.panel-heading {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 14px;
		padding: 14px 16px;
		border-bottom: 1px solid rgba(124, 146, 180, 0.14);
		background: #0a1523;
	}

	.panel-heading div {
		display: flex;
		align-items: center;
		gap: 10px;
	}

	.panel-heading span {
		color: #8e9db4;
		font-size: 0.8rem;
		font-weight: 850;
		text-transform: uppercase;
	}

	.panel-heading strong {
		color: #ffffff;
		font-size: 0.95rem;
	}

	.panel-heading button:disabled,
	.actions button:disabled {
		cursor: wait;
		opacity: 0.6;
	}

	.analysis-list {
		display: grid;
	}

	.analysis-row {
		display: grid;
		grid-template-columns: 176px minmax(0, 1fr) 132px;
		gap: 18px;
		align-items: start;
		padding: 16px 18px;
		border-bottom: 1px solid rgba(124, 146, 180, 0.12);
	}

	.analysis-row:last-child {
		border-bottom: 0;
	}

	.thumbnail {
		width: 176px;
		height: 110px;
		overflow: hidden;
		border: 1px solid rgba(124, 146, 180, 0.18);
		border-radius: 7px;
		background: #050b13;
	}

	.thumbnail img {
		display: block;
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.thumbnail-placeholder {
		display: grid;
		width: 100%;
		height: 100%;
		place-items: center;
		align-content: center;
		gap: 6px;
		background:
			linear-gradient(135deg, rgba(60, 83, 118, 0.24), transparent),
			repeating-linear-gradient(
				-45deg,
				rgba(255, 255, 255, 0.035) 0,
				rgba(255, 255, 255, 0.035) 1px,
				transparent 1px,
				transparent 9px
			);
	}

	.thumbnail-placeholder span {
		color: #6f82a0;
		font-size: 0.7rem;
		font-weight: 900;
	}

	.thumbnail-placeholder strong {
		color: #b8c7dc;
		font-size: 0.82rem;
	}

	.analysis-main {
		display: grid;
		align-content: start;
		gap: 11px;
		min-width: 0;
		padding-top: 1px;
	}

	.analysis-topline {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto;
		gap: 14px;
		align-items: start;
	}

	.site-copy {
		min-width: 0;
	}

	h2 {
		margin: 0 0 5px;
		overflow: hidden;
		color: #ffffff;
		font-size: 1rem;
		line-height: 1.25;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.site-copy a {
		display: block;
		overflow: hidden;
		color: #91a4c0;
		font-size: 0.86rem;
		text-decoration: none;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.site-copy a:hover {
		color: #b8c9e5;
	}

	.badges {
		display: flex;
		flex: 0 0 auto;
		gap: 8px;
		align-items: start;
		justify-content: end;
	}

	.score-badge,
	.status-badge {
		display: inline-grid;
		min-height: 28px;
		place-items: center;
		border: 1px solid rgba(124, 146, 180, 0.18);
		border-radius: 7px;
		padding: 0 10px;
		font-size: 0.78rem;
		font-weight: 850;
	}

	.score-badge[data-tone="strong"] {
		border-color: rgba(82, 241, 142, 0.3);
		background: rgba(44, 218, 84, 0.12);
		color: #69f684;
	}

	.score-badge[data-tone="good"] {
		border-color: rgba(81, 150, 255, 0.34);
		background: rgba(55, 112, 230, 0.14);
		color: #8db7ff;
	}

	.score-badge[data-tone="watch"] {
		border-color: rgba(255, 190, 64, 0.3);
		background: rgba(255, 184, 56, 0.12);
		color: #ffd16b;
	}

	.score-badge[data-tone="low"] {
		border-color: rgba(255, 75, 97, 0.34);
		background: rgba(255, 75, 97, 0.12);
		color: #ff8290;
	}

	.status-badge[data-status="PendingReview"] {
		color: #ffd16b;
	}

	.status-badge[data-status="Approved"] {
		color: #69f684;
	}

	.status-badge[data-status="Rejected"] {
		color: #ff8290;
	}

	.status-badge[data-status="Superseded"] {
		color: #a8b5c8;
	}

	.meta-line {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
		align-items: center;
		color: #8291aa;
		font-size: 0.8rem;
	}

	.meta-line i {
		width: 4px;
		height: 4px;
		border-radius: 50%;
		background: #465772;
	}

	.queue-flags {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
	}

	.queue-flags span {
		min-height: 24px;
		border: 1px solid rgba(255, 190, 64, 0.28);
		border-radius: 999px;
		background: rgba(255, 184, 56, 0.1);
		color: #ffd16b;
		padding: 3px 9px;
		font-size: 0.74rem;
		font-weight: 850;
	}

	.content-warning {
		display: grid;
		gap: 6px;
		border: 1px solid rgba(255, 104, 92, 0.32);
		border-radius: 7px;
		background: rgba(255, 88, 78, 0.09);
		padding: 9px 10px;
	}

	.content-warning span {
		color: #ffb1aa;
		font-size: 0.72rem;
		font-weight: 900;
		text-transform: uppercase;
	}

	.content-warning p {
		margin: 0;
		color: #ffc9c5;
		font-size: 0.8rem;
		line-height: 1.45;
	}

	.replacement-comparison {
		display: grid;
		gap: 6px;
		border: 1px solid rgba(255, 190, 64, 0.24);
		border-radius: 7px;
		background: rgba(255, 184, 56, 0.07);
		padding: 9px 10px;
	}

	.replacement-comparison > span {
		color: #ffd16b;
		font-size: 0.72rem;
		font-weight: 900;
		text-transform: uppercase;
	}

	.replacement-comparison p {
		display: flex;
		flex-wrap: wrap;
		gap: 7px;
		align-items: center;
		margin: 0;
		color: #c8d4e5;
		font-size: 0.8rem;
		line-height: 1.35;
	}

	.replacement-comparison strong {
		max-width: 220px;
		overflow: hidden;
		color: #ffffff;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.replacement-comparison em {
		color: #f5c768;
		font-style: normal;
	}

	.screenshot-failure {
		display: grid;
		gap: 5px;
		border: 1px solid rgba(255, 116, 72, 0.24);
		border-radius: 7px;
		background: rgba(255, 116, 72, 0.08);
		padding: 8px 10px;
	}

	.screenshot-failure span {
		color: #ffb06d;
		font-size: 0.72rem;
		font-weight: 900;
		text-transform: uppercase;
	}

	.screenshot-failure p {
		margin: 0;
		color: #ffd5bd;
		font-size: 0.8rem;
		line-height: 1.45;
	}

	.summary {
		display: -webkit-box;
		margin: 0;
		overflow: hidden;
		color: #c8d4e5;
		font-size: 0.9rem;
		line-height: 1.48;
		-webkit-box-orient: vertical;
		-webkit-line-clamp: 2;
		line-clamp: 2;
	}

	.actions {
		display: grid;
		align-content: start;
		gap: 8px;
		width: 132px;
	}

	.actions button {
		min-height: 36px;
		font-weight: 850;
	}

	.actions .approve {
		border-color: rgba(61, 232, 101, 0.34);
		background: rgba(44, 218, 84, 0.12);
		color: #69f684;
	}

	.actions .refresh {
		border-color: rgba(94, 139, 255, 0.34);
		background: rgba(57, 103, 214, 0.12);
		color: #9bbdff;
	}

	.actions .reanalyze {
		border-color: rgba(121, 236, 209, 0.34);
		background: rgba(67, 220, 188, 0.1);
		color: #8ff4de;
	}

	.actions .reject {
		border-color: rgba(255, 75, 97, 0.34);
		background: rgba(255, 75, 97, 0.1);
		color: #ff8290;
	}

	.actions .remove {
		min-height: 42px;
		border-color: rgba(255, 176, 64, 0.34);
		background: rgba(255, 176, 64, 0.1);
		color: #ffc26d;
		line-height: 1.16;
		white-space: normal;
	}

	.actions .restore {
		min-height: 42px;
		border-color: rgba(94, 139, 255, 0.34);
		background: rgba(57, 103, 214, 0.12);
		color: #9bbdff;
		line-height: 1.16;
		white-space: normal;
	}

	.actions .delete {
		min-height: 42px;
		border-color: rgba(255, 75, 97, 0.34);
		background: rgba(255, 75, 97, 0.12);
		color: #ff9aa5;
		line-height: 1.16;
		white-space: normal;
	}

	.empty-state {
		display: grid;
		place-items: center;
		gap: 6px;
		min-height: 280px;
		padding: 36px;
		text-align: center;
	}

	.empty-state strong {
		color: #ffffff;
	}

	.empty-state p {
		margin: 0;
		color: #8291aa;
	}

	.skeleton-list {
		display: grid;
		gap: 1px;
	}

	.skeleton-list div {
		height: 134px;
		background: linear-gradient(
			90deg,
			rgba(91, 111, 144, 0.08),
			rgba(164, 181, 210, 0.16),
			rgba(91, 111, 144, 0.08)
		);
		background-size: 220% 100%;
		animation: shimmer 1.2s linear infinite;
	}

	@keyframes shimmer {
		from {
			background-position: 100% 0;
		}
		to {
			background-position: -100% 0;
		}
	}

	@media (max-width: 900px) {
		.review-shell {
			padding-top: 172px;
		}

		.topbar {
			display: grid;
			align-items: stretch;
		}

		.topbar-tools {
			display: grid;
			gap: 10px;
		}

		.environment-control {
			grid-template-columns: auto minmax(0, 1fr) auto;
			justify-content: start;
		}

		.counters {
			display: grid;
			grid-template-columns: repeat(3, minmax(0, 1fr));
		}

		.controls {
			grid-template-columns: 1fr;
		}

		.tabs {
			justify-self: start;
		}

		.analysis-row {
			grid-template-columns: 132px minmax(0, 1fr);
			gap: 14px;
		}

		.thumbnail {
			width: 132px;
			height: 84px;
		}

		.actions {
			grid-column: 1 / -1;
			grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
			width: auto;
		}
	}

	@media (max-width: 620px) {
		.review-shell {
			padding: 246px 12px 24px;
		}

		.access-panel {
			grid-template-columns: 1fr;
			margin: 0;
		}

		.brand-block {
			align-items: start;
		}

		.api-source {
			max-width: 100%;
			white-space: normal;
		}

		.environment-control {
			grid-template-columns: 1fr;
		}

		.environment-switch {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}

		.environment-control a {
			text-align: center;
		}

		.counters button {
			grid-template-columns: 1fr;
			justify-items: start;
			gap: 2px;
			padding: 8px 10px;
		}

		.tabs {
			display: grid;
			width: 100%;
			grid-template-columns: repeat(3, minmax(0, 1fr));
		}

		.tabs button {
			padding: 0 8px;
		}

		.analysis-row {
			grid-template-columns: 1fr;
			padding: 14px;
		}

		.thumbnail {
			width: 100%;
			height: auto;
			aspect-ratio: 16 / 9;
		}

		.analysis-topline {
			grid-template-columns: 1fr;
		}

		.badges {
			flex-wrap: wrap;
			justify-content: start;
		}

		.replacement-comparison strong {
			max-width: 100%;
		}

		.actions {
			grid-template-columns: 1fr;
		}
	}
</style>

