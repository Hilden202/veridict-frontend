<script lang="ts">
	type ScoreItem = {
		label: string;
		value: number;
		icon: string;
		invert?: boolean;
	};

	type Props = {
		items: ScoreItem[];
		loading?: boolean;
	};

	let { items, loading = false }: Props = $props();

	function scoreTone(value: number, invert = false) {
		const normalized = invert ? 10 - value : value;
		if (normalized < 4) return "danger";
		if (normalized < 7) return "warning";
		return "success";
	}
</script>

<div class="score-bars" class:loading>
	{#each items as item, index}
		<div class="bar-row" style={`--delay: ${index * 110}ms`}>
			<div class="metric-label">
				<span class="metric-icon">{item.icon}</span>
				<span>{item.label}</span>
			</div>
			<div class="bar-track">
				<span
					class="bar-fill"
					data-tone={scoreTone(item.value, item.invert)}
					style={`width: ${loading ? 48 + index * 8 : Math.max(0, Math.min(10, item.value)) * 10}%`}
				></span>
			</div>
			<strong data-tone={scoreTone(item.value, item.invert)}
				>{loading ? "--" : item.value.toFixed(1)}</strong
			>
		</div>
	{/each}
</div>

<style>
	.score-bars {
		display: grid;
		gap: 20px;
		min-width: min(100%, 430px);
	}

	.bar-row {
		display: grid;
		grid-template-columns: minmax(160px, 1fr) minmax(130px, 245px) 44px;
		align-items: center;
		gap: 18px;
		animation: riseIn 520ms ease both;
		animation-delay: var(--delay);
	}

	.metric-label {
		display: flex;
		align-items: center;
		gap: 13px;
		color: #eef4ff;
		font-size: 1rem;
		font-weight: 600;
	}

	.metric-icon {
		display: grid;
		width: 24px;
		height: 24px;
		place-items: center;
		color: #cbd8f0;
		font-size: 1.1rem;
	}

	.bar-track {
		height: 10px;
		overflow: hidden;
		border-radius: 999px;
		background: rgba(124, 145, 174, 0.13);
		box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.02);
	}

	.bar-fill {
		display: block;
		height: 100%;
		min-width: 18px;
		border-radius: inherit;
		transition: width 900ms cubic-bezier(0.2, 0.8, 0.2, 1);
		animation: fillIn 900ms cubic-bezier(0.2, 0.8, 0.2, 1) both;
	}

	[data-tone="success"] {
		color: #5ff277;
	}

	[data-tone="warning"] {
		color: #ffcc5f;
	}

	[data-tone="danger"] {
		color: #ff7786;
	}

	.bar-fill[data-tone="success"] {
		background: linear-gradient(90deg, #29d64d, #64ec78);
		box-shadow: 0 0 18px rgba(56, 232, 92, 0.35);
	}

	.bar-fill[data-tone="warning"] {
		background: linear-gradient(90deg, #ffb038, #ffdc6b);
		box-shadow: 0 0 18px rgba(255, 185, 55, 0.3);
	}

	.bar-fill[data-tone="danger"] {
		background: linear-gradient(90deg, #ff405f, #ff8578);
		box-shadow: 0 0 18px rgba(255, 78, 98, 0.28);
	}

	.bar-row strong {
		color: #eaf1ff;
		font-size: 1rem;
		text-align: right;
	}

	.loading .bar-fill {
		background: linear-gradient(
			90deg,
			rgba(96, 120, 155, 0.18),
			rgba(174, 190, 215, 0.36),
			rgba(96, 120, 155, 0.18)
		);
		background-size: 220% 100%;
		animation: shimmer 1.15s linear infinite;
		box-shadow: none;
	}

	@keyframes fillIn {
		from {
			width: 0;
		}
	}

	@keyframes riseIn {
		from {
			opacity: 0;
			transform: translateY(8px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	@keyframes shimmer {
		from {
			background-position: 100% 0;
		}
		to {
			background-position: -100% 0;
		}
	}

	@media (max-width: 640px) {
		.bar-row {
			grid-template-columns: 1fr 48px;
			gap: 10px 14px;
		}

		.bar-track {
			grid-column: 1 / -1;
			grid-row: 2;
		}
	}
</style>
