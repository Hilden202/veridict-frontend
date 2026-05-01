<script lang="ts">
	type Props = {
		title: string;
		items: string[];
		variant: "strengths" | "weaknesses" | "improvements";
		loading?: boolean;
	};

	let { title, items, variant, loading = false }: Props = $props();

	const headingIcon = {
		strengths: "✦",
		weaknesses: "!",
		improvements: "↗",
	};

	const bulletIcon = {
		strengths: "✓",
		weaknesses: "−",
		improvements: "•",
	};
</script>

<section class="analysis-card" data-variant={variant}>
	<h2><span>{headingIcon[variant]}</span>{title}</h2>

	{#if loading}
		<div class="skeleton-list" aria-hidden="true">
			<span></span>
			<span></span>
			<span></span>
			<span></span>
		</div>
	{:else}
		<ul>
			{#each items?.length ? items : ["No findings returned for this section."] as item}
				<li><span>{bulletIcon[variant]}</span>{item}</li>
			{/each}
		</ul>
	{/if}
</section>

<style>
	.analysis-card {
		min-height: unset;
		padding: clamp(18px, 1.8vw, 24px);
		border: 1px solid rgba(130, 153, 188, 0.14);
		border-radius: 14px;
		background: linear-gradient(
				145deg,
				rgba(18, 34, 55, 0.88),
				rgba(8, 20, 35, 0.9)
			),
			radial-gradient(
				circle at 22% 0%,
				rgba(88, 130, 255, 0.12),
				transparent 45%
			);
		box-shadow: 0 22px 55px rgba(0, 0, 0, 0.22);
		display: flex;
		flex-direction: column;
		justify-content: flex-start;
		height: 100%;
		min-width: 0;
		transition: transform 180ms ease, box-shadow 180ms ease;
	}

	.analysis-card:hover {
		transform: translateY(-4px);
		box-shadow: 0 28px 70px rgba(0, 0, 0, 0.35);
	}

	h2 {
		display: flex;
		align-items: center;
		gap: 10px;
		margin: 0 0 16px;
		color: #f7fbff;
		font-size: 1.14rem;
		line-height: 1.2;
	}

	h2 span {
		display: grid;
		flex: 0 0 24px;
		width: 24px;
		height: 24px;
		place-items: center;
		border-radius: 8px;
		font-weight: 900;
	}

	ul {
		display: grid;
		gap: 11px;
		margin: 0;
		padding: 0;
		list-style: none;
		max-width: 38rem;
	}

	ul {
		line-height: 1.5;
		word-break: break-word;
	}

	li {
		display: grid;
		grid-template-columns: 20px minmax(0, 1fr);
		gap: 11px;
		align-items: start;
		color: #dce5f4;
		font-size: 0.94rem;
		line-height: 1.5;
	}

	li span {
		display: grid;
		width: 17px;
		height: 17px;
		margin-top: 3px;
		place-items: center;
		border: 2px solid currentColor;
		border-radius: 50%;
		font-size: 0.76rem;
		font-weight: 900;
		line-height: 1;
	}

	[data-variant="strengths"] h2 span,
	[data-variant="strengths"] li span {
		color: #35f56e;
	}

	[data-variant="weaknesses"] h2 span,
	[data-variant="weaknesses"] li span {
		color: #ffb332;
	}

	[data-variant="improvements"] h2 span,
	[data-variant="improvements"] li span {
		color: #8d6bff;
	}

	[data-variant="improvements"] li span {
		border: 0;
		background: currentColor;
		color: transparent;
		transform: scale(0.52);
	}

	.skeleton-list {
		display: grid;
		gap: 12px;
	}

	.skeleton-list span {
		height: 18px;
		border-radius: 999px;
		background: linear-gradient(
			90deg,
			rgba(105, 130, 165, 0.12),
			rgba(202, 212, 230, 0.22),
			rgba(105, 130, 165, 0.12)
		);
		background-size: 220% 100%;
		animation: shimmer 1.15s linear infinite;
	}

	.skeleton-list span:nth-child(2) {
		width: 84%;
	}

	.skeleton-list span:nth-child(3) {
		width: 92%;
	}

	.skeleton-list span:nth-child(4) {
		width: 76%;
	}

	@keyframes shimmer {
		from {
			background-position: 100% 0;
		}
		to {
			background-position: -100% 0;
		}
	}
</style>
