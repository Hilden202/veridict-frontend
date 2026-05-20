<script lang="ts">
	import { onMount } from "svelte";

	type ReviewStatus = "PendingReview" | "Approved" | "Rejected";

	type ReviewAnalysis = {
		id: string;
		siteTitle?: string;
		url?: string;
		screenshotPath?: string;
		screenshotThumbnailPath?: string;
		category?: string;
		score?: number;
		status?: ReviewStatus | string;
		summary?: string;
		createdAt?: string;
	};

	type Tab = "pending" | "approved" | "rejected";

	const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:5293";

	let analyses = $state<ReviewAnalysis[]>([]);
	let activeTab = $state<Tab>("pending");
	let query = $state("");
	let loading = $state(true);
	let actionId = $state<string | null>(null);
	let error = $state("");
	let imageFailures = $state<string[]>([]);

	const pendingCount = $derived(countByStatus("PendingReview"));
	const approvedCount = $derived(countByStatus("Approved"));
	const rejectedCount = $derived(countByStatus("Rejected"));
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
		{ id: "pending", label: "Pending" },
		{ id: "approved", label: "Approved" },
		{ id: "rejected", label: "Rejected" },
	];

	onMount(() => {
		loadAnalyses();
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
			error = "Could not load the review queue. Make sure the API is running locally.";
		} finally {
			loading = false;
		}
	}

	async function fetchAnalyses(status: Tab) {
		const response = await fetch(`${API_BASE}/internal/review/analyses/${status}`);

		if (!response.ok) {
			throw new Error(`Review API returned ${response.status}`);
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

	async function reviewAction(id: string, action: "approve" | "reject") {
		if (actionId) return;

		actionId = id;
		error = "";

		try {
			const response = await fetch(
				`${API_BASE}/internal/review/analyses/${id}/${action}`,
				{ method: "POST" },
			);

			if (!response.ok) {
				throw new Error(`Review action returned ${response.status}`);
			}

			const updated = (await response.json()) as ReviewAnalysis;
			analyses = mergeAnalyses([
				...analyses.filter((analysis) => analysis.id !== updated.id),
				updated,
			]);
		} catch {
			error = `Could not ${action} this analysis.`;
		} finally {
			actionId = null;
		}
	}

	async function refreshScreenshot(id: string) {
		if (actionId) return;

		actionId = id;
		error = "";

		try {
			const response = await fetch(
				`${API_BASE}/internal/review/analyses/${id}/refresh-screenshot`,
				{ method: "POST" },
			);

			if (!response.ok) {
				throw new Error(`Screenshot refresh returned ${response.status}`);
			}

			const updated = (await response.json()) as ReviewAnalysis;
			imageFailures = imageFailures.filter((failedId) => failedId !== updated.id);
			analyses = mergeAnalyses([
				...analyses.filter((analysis) => analysis.id !== updated.id),
				updated,
			]);
		} catch {
			error = "Could not refresh this screenshot. See API logs for render details.";
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
		return status === "Rejected";
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
		return "PendingReview";
	}

	function statusLabel(status?: string) {
		const normalized = normalizeStatus(status);
		return normalized === "PendingReview" ? "Pending" : normalized;
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

	function formatDate(value?: string) {
		if (!value) return "Unknown";

		const date = new Date(value);
		if (Number.isNaN(date.getTime())) return "Unknown";

		return new Intl.DateTimeFormat(undefined, {
			month: "short",
			day: "numeric",
			year: "numeric",
			hour: "2-digit",
			minute: "2-digit",
		}).format(date);
	}

	function screenshotSource(analysis: ReviewAnalysis) {
		if (imageFailures.includes(analysis.id)) return "";

		const reference =
			analysis.screenshotThumbnailPath || analysis.screenshotPath || "";

		if (!reference.trim()) return "";

		if (/^(https?:|data:|blob:)/i.test(reference)) {
			return reference;
		}

		if (reference.startsWith("/storage/")) {
			return `${API_BASE}${reference}`;
		}

		if (reference.startsWith("storage/")) {
			return `${API_BASE}/${reference}`;
		}

		if (reference.startsWith("/")) {
			return reference;
		}

		if (reference.startsWith("screenshots/")) {
			return `/${reference}`;
		}

		return `${API_BASE}/${reference}`;
	}

	function markImageFailed(id: string) {
		if (!imageFailures.includes(id)) {
			imageFailures = [...imageFailures, id];
		}
	}
</script>

<svelte:head>
	<title>Veridict Review Queue</title>
	<meta
		name="description"
		content="Internal Veridict moderation dashboard for reviewing generated analyses."
	/>
</svelte:head>

<main class="review-shell">
	<header class="topbar">
		<div class="brand-block">
			<a href="/" aria-label="Back to Veridict home">
				<span class="mark"><i></i><b></b></span>
			</a>
			<div>
				<p>Internal moderation</p>
				<h1>Veridict Review Queue</h1>
			</div>
		</div>

		<div class="counters" aria-label="Review status counters">
			<button
				class:active={activeTab === "pending"}
				onclick={() => (activeTab = "pending")}
				type="button"
			>
				<span>Pending</span>
				<strong>{pendingCount}</strong>
			</button>
			<button
				class:active={activeTab === "approved"}
				onclick={() => (activeTab = "approved")}
				type="button"
			>
				<span>Approved</span>
				<strong>{approvedCount}</strong>
			</button>
			<button
				class:active={activeTab === "rejected"}
				onclick={() => (activeTab = "rejected")}
				type="button"
			>
				<span>Rejected</span>
				<strong>{rejectedCount}</strong>
			</button>
		</div>
	</header>

	<section class="controls" aria-label="Review controls">
		<label class="search-field">
			<span>Search</span>
			<input
				bind:value={query}
				placeholder="Filter by title, URL, category or summary"
				type="search"
			/>
		</label>

		<nav class="tabs" aria-label="Review status tabs">
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
			<button onclick={loadAnalyses} type="button">Retry</button>
		</section>
	{/if}

	<section class="queue-panel" aria-live="polite">
		<div class="panel-heading">
			<div>
				<span>{statusLabel(activeTab === "pending" ? "PendingReview" : activeTab === "approved" ? "Approved" : "Rejected")}</span>
				<strong>{filteredAnalyses.length} items</strong>
			</div>
			<button onclick={loadAnalyses} disabled={loading} type="button">
				{loading ? "Refreshing" : "Refresh"}
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
									alt={`Screenshot for ${analysis.siteTitle || analysis.url || "analysis"}`}
									onerror={() => markImageFailed(analysis.id)}
								/>
							{:else}
								<div class="thumbnail-placeholder">
									<span>WEBP</span>
									<strong>No screenshot</strong>
								</div>
							{/if}
						</div>

						<div class="analysis-main">
							<div class="analysis-topline">
								<div class="site-copy">
									<h2>{analysis.siteTitle || "Untitled site"}</h2>
									<a href={analysis.url} target="_blank" rel="noreferrer">
										{analysis.url}
									</a>
								</div>

								<div class="badges">
									<span class="score-badge" data-tone={scoreTone(analysis.score)}
										>{formatScore(analysis.score)}</span
									>
									<span class="status-badge" data-status={normalizeStatus(analysis.status)}
										>{statusLabel(analysis.status)}</span
									>
								</div>
							</div>

							<div class="meta-line">
								<span>{analysis.category || "Uncategorized"}</span>
								<i></i>
								<span>{formatDate(analysis.createdAt)}</span>
							</div>

							<p class="summary">{analysis.summary || "No summary returned."}</p>
						</div>

						<div class="actions">
							<button
								class="refresh"
								disabled={actionId === analysis.id}
								onclick={() => refreshScreenshot(analysis.id)}
								type="button"
							>
								Refresh shot
							</button>

							{#if normalizeStatus(analysis.status) === "PendingReview"}
								<button
									class="approve"
									disabled={actionId === analysis.id}
									onclick={() => reviewAction(analysis.id, "approve")}
									type="button"
								>
									Approve
								</button>
								<button
									class="reject"
									disabled={actionId === analysis.id}
									onclick={() => reviewAction(analysis.id, "reject")}
									type="button"
								>
									Reject
								</button>
							{/if}
						</div>
					</article>
				{/each}
			</div>
		{:else}
			<div class="empty-state">
				<strong>No {tabs.find((tab) => tab.id === activeTab)?.label.toLowerCase()} analyses</strong>
				<p>The queue is clear for this view.</p>
			</div>
		{/if}
	</section>
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

	h1 {
		margin: 0;
		color: #ffffff;
		font-size: clamp(1.1rem, 2vw, 1.45rem);
		line-height: 1.1;
		letter-spacing: 0;
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

	input:focus {
		border-color: rgba(93, 136, 255, 0.72);
		box-shadow: 0 0 0 4px rgba(75, 100, 255, 0.12);
	}

	input::placeholder {
		color: #718096;
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

	.actions .reject {
		border-color: rgba(255, 75, 97, 0.34);
		background: rgba(255, 75, 97, 0.1);
		color: #ff8290;
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
			padding-top: 152px;
		}

		.topbar {
			display: grid;
			align-items: stretch;
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
			padding-top: 162px;
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
		}

		.thumbnail {
			width: 100%;
			height: auto;
			aspect-ratio: 16 / 8;
		}

		.analysis-topline {
			grid-template-columns: 1fr;
		}

		.badges {
			flex-wrap: wrap;
		}
	}
</style>
