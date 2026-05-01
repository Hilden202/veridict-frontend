<script lang="ts">
	import { onDestroy, untrack } from "svelte";

	type Props = {
		score: number;
		loading?: boolean;
	};

	let { score, loading = false }: Props = $props();
	let displayed = $state(0);
	let animationFrame = 0;
	let lastTarget = -1;

	const radius = 138;
	const circumference = 2 * Math.PI * radius;

	const normalizedScore = $derived(
		Math.max(0, Math.min(10, Number(score) || 0)),
	);
	const progress = $derived(displayed / 10);
	const strokeOffset = $derived(circumference * (1 - progress));
	const tone = $derived(
		displayed < 4 ? "danger" : displayed < 7 ? "warning" : "success",
	);
	const label = $derived(
		displayed < 4 ? "Needs work" : displayed < 7 ? "Fair" : "Good",
	);

	function animateTo(target: number) {
		cancelAnimationFrame(animationFrame);

		const start = untrack(() => displayed);
		const delta = target - start;
		const startTime = performance.now();
		const duration = 1200;

		function tick(now: number) {
			const elapsed = Math.min((now - startTime) / duration, 1);
			const eased = 1 - Math.pow(1 - elapsed, 3);
			displayed = start + delta * eased;

			if (elapsed < 1) {
				animationFrame = requestAnimationFrame(tick);
			}
		}

		animationFrame = requestAnimationFrame(tick);
	}

	$effect(() => {
		const target = loading ? 6.8 : normalizedScore;
		if (Math.abs(target - lastTarget) > 0.001) {
			lastTarget = target;
			animateTo(target);
		}
	});

	onDestroy(() => cancelAnimationFrame(animationFrame));
</script>

<div class:loading class="score-ring" data-tone={tone}>
	<svg viewBox="0 0 320 320" aria-hidden="true">
		<defs>
			<linearGradient id="scoreGreen" x1="34" x2="246" y1="224" y2="44">
				<stop stop-color="#23d64d" />
				<stop offset="1" stop-color="#7df486" />
			</linearGradient>
			<linearGradient id="scoreYellow" x1="34" x2="246" y1="224" y2="44">
				<stop stop-color="#ff9f2e" />
				<stop offset="1" stop-color="#ffe36d" />
			</linearGradient>
			<linearGradient id="scoreRed" x1="34" x2="246" y1="224" y2="44">
				<stop stop-color="#ff3d57" />
				<stop offset="1" stop-color="#ff8a70" />
			</linearGradient>
			<filter id="scoreGlow" x="-40%" y="-40%" width="180%" height="180%">
				<feGaussianBlur stdDeviation="8" result="blur" />
				<feMerge>
					<feMergeNode in="blur" />
					<feMergeNode in="SourceGraphic" />
				</feMerge>
			</filter>
		</defs>

		<circle class="track" cx="160" cy="160" r={radius} />
		<circle
			class="meter"
			cx="160"
			cy="160"
			r={radius}
			stroke-dasharray={circumference}
			stroke-dashoffset={strokeOffset}
		/>
	</svg>

	<div class="score-copy">
		<span>VERIDICT SCORE</span>
		<strong>{loading ? "..." : displayed.toFixed(2)}</strong>
		<small>/ 10</small>
		<em>{loading ? "Analyzing" : label}</em>
	</div>
</div>

<style>
	.score-ring {
		position: relative;
		width: clamp(300px, 30vw, 380px);
		max-width: 100%;
		margin: 0 auto;
		aspect-ratio: 1;
		display: grid;
		place-items: center;
		filter: drop-shadow(0 0 22px rgba(56, 232, 92, 0.18));
	}

	.score-ring::before {
		content: "";
		position: absolute;
		inset: 10%;
		border-radius: 50%;
		background: radial-gradient(
			circle,
			rgba(44, 218, 84, 0.16),
			transparent 70%
		);
	}

	.score-ring svg {
		position: absolute;
		inset: 0;
		transform: rotate(-90deg);
		overflow: visible;
	}

	circle {
		fill: none;
		stroke-linecap: round;
		stroke-width: 14;
	}

	.track {
		stroke: rgba(114, 137, 165, 0.12);
	}

	.meter {
		filter: url("#scoreGlow");
		transition: stroke 240ms ease;
	}

	[data-tone="success"] .meter {
		stroke: url("#scoreGreen");
	}

	[data-tone="warning"] .meter {
		stroke: url("#scoreYellow");
	}

	[data-tone="danger"] .meter {
		stroke: url("#scoreRed");
	}

	[data-tone="warning"] {
		filter: drop-shadow(0 0 20px rgba(255, 190, 64, 0.18));
	}

	[data-tone="danger"] {
		filter: drop-shadow(0 0 20px rgba(255, 70, 92, 0.18));
	}

	.score-copy {
		position: relative;
		z-index: 1;
		display: grid;
		place-items: center;
		text-align: center;
	}

	.score-copy span {
		margin-bottom: 9px;
		color: #f4f8ff;
		font-size: 0.82rem;
		font-weight: 800;
		letter-spacing: 0;
	}

	.score-copy strong {
		color: #ffffff;
		font-size: clamp(2.5rem, 3.2vw, 3.25rem);
		line-height: 0.95;
		text-shadow: 0 6px 18px rgba(0, 0, 0, 0.38);
	}

	.score-copy small {
		margin-top: 9px;
		color: #f1f6ff;
		font-size: 1rem;
		font-weight: 700;
	}

	.score-copy em {
		margin-top: 11px;
		padding: 7px 17px;
		border-radius: 999px;
		background: rgba(49, 218, 86, 0.16);
		color: #63fb7f;
		font-style: normal;
		font-weight: 800;
	}

	[data-tone="warning"] .score-copy em {
		background: rgba(255, 188, 54, 0.16);
		color: #ffd36a;
	}

	[data-tone="danger"] .score-copy em {
		background: rgba(255, 75, 97, 0.16);
		color: #ff8290;
	}

	.loading .meter {
		animation: loadingPulse 1.4s ease-in-out infinite alternate;
	}

	@keyframes loadingPulse {
		from {
			opacity: 0.48;
			stroke-dashoffset: 650;
		}
		to {
			opacity: 1;
			stroke-dashoffset: 230;
		}
	}

	@media (max-width: 760px) {
		.score-ring {
			width: min(78vw, 300px);
		}
	}
</style>
