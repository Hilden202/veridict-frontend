<script lang="ts">
	type CatalogItem = {
		id?: string;
		title?: string;
		url?: string;
		category?: string;
		score?: number;
		summary?: string;
		topics?: string[];
		screenshotThumbnailPath?: string;
	};

	type Props = {
		item: CatalogItem;
		apiBase?: string;
		publicAssetBase?: string;
		compact?: boolean;
	};

	let { item, apiBase = "", publicAssetBase = "", compact = false }: Props = $props();

	function formatScore(score?: number) {
		return typeof score === "number" ? score.toFixed(1) : "--";
	}

	function imageSource(path?: string) {
		if (!path) return "";
		if (/^(https?:|data:|blob:)/i.test(path)) return path;
		if (path.startsWith("/screenshots/")) return `${publicAssetBase}${path}`;
		if (path.startsWith("/storage/")) return `${apiBase}${path}`;
		if (path.startsWith("screenshots/")) return `${publicAssetBase}/${path}`;
		return `${apiBase}/${path}`;
	}

	function displayHost(url?: string) {
		if (!url) return "";

		try {
			return new URL(url).hostname.replace(/^www\./, "");
		} catch {
			return url.replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0];
		}
	}
</script>

<a class="catalog-card" class:compact href={item.url} target="_blank" rel="noreferrer">
	<div class="shot">
		{#if imageSource(item.screenshotThumbnailPath)}
			<img src={imageSource(item.screenshotThumbnailPath)} alt={item.title || item.url || "Approved website"} />
		{:else}
			<div class="shot-placeholder">
				<span>VERIDICT</span>
				<strong>No preview yet</strong>
			</div>
		{/if}

		<div class="score-ring" aria-label={`Score ${formatScore(item.score)} out of 10`}>
			<strong>{formatScore(item.score)}</strong>
		</div>
	</div>

	<div class="copy">
		<div class="meta">
			<span>{item.category || "Uncategorized"}</span>
			<small>{displayHost(item.url)}</small>
		</div>

		<h3>{item.title || displayHost(item.url) || "Untitled site"}</h3>
		<p>{item.summary || "Approved Veridict analysis."}</p>
	</div>
</a>

<style>
	.catalog-card {
		display: grid;
		overflow: hidden;
		border: 1px solid rgba(134, 154, 188, 0.17);
		border-radius: 12px;
		background:
			linear-gradient(180deg, rgba(13, 27, 44, 0.96), rgba(8, 19, 32, 0.98)),
			#0b1624;
		color: inherit;
		text-decoration: none;
		box-shadow: 0 22px 60px rgba(0, 0, 0, 0.24);
		transition:
			transform 180ms ease,
			border-color 180ms ease,
			box-shadow 180ms ease;
	}

	.catalog-card:hover {
		border-color: rgba(95, 139, 255, 0.42);
		box-shadow: 0 28px 70px rgba(0, 0, 0, 0.34);
		transform: translateY(-3px);
	}

	.shot {
		position: relative;
		overflow: hidden;
		aspect-ratio: 16 / 9;
		background: #06101b;
	}

	img {
		display: block;
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.shot-placeholder {
		display: grid;
		height: 100%;
		place-items: center;
		align-content: center;
		gap: 8px;
		background:
			linear-gradient(135deg, rgba(70, 96, 136, 0.24), transparent),
			repeating-linear-gradient(
				-45deg,
				rgba(255, 255, 255, 0.035) 0,
				rgba(255, 255, 255, 0.035) 1px,
				transparent 1px,
				transparent 10px
			);
	}

	.shot-placeholder span {
		color: #667894;
		font-size: 0.72rem;
		font-weight: 900;
	}

	.shot-placeholder strong {
		color: #c2d0e4;
		font-size: 0.92rem;
	}

	.score-ring {
		position: absolute;
		right: 12px;
		bottom: 12px;
		display: grid;
		width: 54px;
		height: 54px;
		place-items: center;
		border: 2px solid rgba(87, 239, 123, 0.78);
		border-radius: 50%;
		background: rgba(3, 9, 16, 0.82);
		box-shadow: 0 0 22px rgba(53, 245, 110, 0.24);
	}

	.score-ring strong {
		color: #ffffff;
		font-size: 1rem;
	}

	.copy {
		display: grid;
		gap: 10px;
		padding: 16px;
		min-width: 0;
	}

	.meta {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
	}

	.meta span {
		display: inline-grid;
		min-height: 24px;
		place-items: center;
		border: 1px solid rgba(95, 139, 255, 0.32);
		border-radius: 999px;
		background: rgba(69, 102, 226, 0.12);
		color: #9ebaff;
		padding: 0 9px;
		font-size: 0.73rem;
		font-weight: 850;
	}

	.meta small {
		overflow: hidden;
		color: #8495ad;
		font-size: 0.78rem;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	h3 {
		margin: 0;
		overflow: hidden;
		color: #ffffff;
		font-size: 1.02rem;
		line-height: 1.25;
		word-break: break-word;
	}

	p {
		display: -webkit-box;
		margin: 0;
		overflow: hidden;
		color: #c4cedd;
		font-size: 0.9rem;
		line-height: 1.5;
		-webkit-box-orient: vertical;
		-webkit-line-clamp: 3;
		line-clamp: 3;
	}

	.compact .copy {
		padding: 14px;
	}

	@media (max-width: 520px) {
		.catalog-card {
			border-radius: 10px;
		}

		.score-ring {
			right: 10px;
			bottom: 10px;
			width: 46px;
			height: 46px;
		}

		.score-ring strong {
			font-size: 0.9rem;
		}

		.copy {
			padding: 14px;
		}

		.meta {
			display: grid;
			justify-content: stretch;
		}

		.meta small {
			white-space: normal;
		}
	}
</style>
