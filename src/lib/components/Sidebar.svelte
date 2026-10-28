<script lang="ts">
	import { onMount } from "svelte";
	import { isLocalFrontendRuntime } from "$lib/apiEnvironment";

	const navItems = [
		{ label: "Search", icon: "⌕", href: "#search", active: true },
		{ label: "Analyze", icon: "⌂", href: "#analyze" },
	];

	let showModerationShortcut = $state(false);

	onMount(() => {
		showModerationShortcut = isLocalFrontendRuntime();
	});
</script>

<aside class="sidebar" aria-label="Primary navigation">
	<a class="brand" href="/" aria-label="Veridict home">
		<span class="veridict-mark"><i></i><b></b></span>
		<strong>Veridict</strong>
	</a>

	<nav class:has-dev-shortcut={showModerationShortcut}>
		{#each navItems as item}
			<a class:active={item.active} href={item.href}>
				<span>{item.icon}</span>
				{item.label}
			</a>
		{/each}
		{#if showModerationShortcut}
			<a class="dev-shortcut" href="/internal/review">
				<span>▦</span>
				Review
				<em>LOCAL</em>
			</a>
		{/if}
	</nav>

	<div class="sidebar-spacer"></div>

	<a
		class="hilden"
		href="https://hildenmedia.se"
		rel="noreferrer"
		target="_blank"
	>
		<span class="ghost-logo" aria-hidden="true">
			<svg viewBox="0 0 48 48" role="img">
				<path
					d="M10 39V18.5C10 10.5 16.4 5 24 5s14 5.5 14 13.5V39c0 2.2-2.6 3.4-4.2 1.9l-2.7-2.5-3.4 3.1a2.6 2.6 0 0 1-3.5 0L20.9 38l-3.3 3.1C16 42.6 13.4 41.4 13.4 39H10Z"
				/>
				<circle cx="19" cy="21" r="2.6" />
				<circle cx="29" cy="21" r="2.6" />
				<path d="M19 30c2.4 2 7.6 2 10 0" />
			</svg>
		</span>
		<span>Hilden Media</span>
	</a>

</aside>

<style>
	.sidebar {
		position: sticky;
		top: 0;
		display: flex;
		width: 260px;
		height: 100vh;
		flex: 0 0 260px;
		flex-direction: column;
		border-right: 1px solid rgba(137, 158, 191, 0.16);
		background: radial-gradient(
				circle at 90% 10%,
				rgba(101, 74, 255, 0.18),
				transparent 28%
			),
			linear-gradient(
				180deg,
				rgba(8, 20, 35, 0.98),
				rgba(6, 17, 30, 0.98)
			);
	}

	.brand {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 38px 28px 34px;
		color: #ffffff;
		text-decoration: none;
	}

	.brand strong {
		font-size: 1.85rem;
		line-height: 1;
	}

	.veridict-mark {
		position: relative;
		display: inline-flex;
		width: 36px;
		height: 36px;
	}

	.veridict-mark i,
	.veridict-mark b {
		position: absolute;
		bottom: 0;
		width: 15px;
		height: 34px;
		border-radius: 5px;
		transform-origin: bottom;
	}

	.veridict-mark i {
		left: 6px;
		background: linear-gradient(180deg, #8f62ff, #2e92ff);
		transform: skew(20deg);
	}

	.veridict-mark b {
		right: 5px;
		height: 28px;
		background: linear-gradient(180deg, #52f1c8, #4b8cff);
		transform: skew(-22deg);
	}

	nav {
		display: grid;
		gap: 12px;
		padding: 0 26px;
	}

	nav a {
		display: flex;
		align-items: center;
		gap: 16px;
		min-height: 58px;
		padding: 0 16px;
		border-radius: 10px;
		color: #b8c4d8;
		font-size: 1.05rem;
		font-weight: 650;
		text-decoration: none;
		transition:
			background 180ms ease,
			color 180ms ease,
			transform 180ms ease;
	}

	nav a:hover,
	nav a.active {
		background: linear-gradient(
			100deg,
			rgba(29, 82, 128, 0.62),
			rgba(98, 62, 205, 0.58)
		);
		color: #ffffff;
		transform: translateX(2px);
	}

	nav a.dev-shortcut {
		position: relative;
		border: 1px solid rgba(83, 218, 168, 0.26);
		background: rgba(29, 104, 89, 0.16);
		color: #d6fff1;
	}

	nav a.dev-shortcut:hover {
		background: linear-gradient(
			100deg,
			rgba(24, 116, 91, 0.62),
			rgba(41, 93, 143, 0.5)
		);
	}

	nav a.dev-shortcut em {
		margin-left: auto;
		padding: 4px 6px;
		border: 1px solid rgba(113, 238, 194, 0.28);
		border-radius: 999px;
		background: rgba(44, 214, 153, 0.1);
		color: #88f4cf;
		font-size: 0.62rem;
		font-style: normal;
		font-weight: 900;
		letter-spacing: 0;
	}

	nav span {
		width: 22px;
		color: #9eb7ff;
		font-size: 1.25rem;
	}

	.sidebar-spacer {
		flex: 1;
	}

	.hilden {
		display: flex;
		align-items: center;
		gap: 13px;
		padding: 18px 28px 26px;
		color: #ffffff;
		font-weight: 750;
		text-decoration: none;
	}

	.ghost-logo {
		display: grid;
		width: 38px;
		height: 38px;
		place-items: center;
		border-radius: 50%;
		background: linear-gradient(145deg, #f4f6ff, #a98aff);
		box-shadow: 0 0 20px rgba(130, 93, 255, 0.36);
	}

	.ghost-logo svg {
		width: 27px;
		height: 27px;
		fill: #101729;
	}

	.ghost-logo path:last-child {
		fill: none;
		stroke: #101729;
		stroke-width: 2.4;
		stroke-linecap: round;
	}

	@media (max-width: 980px) {
		.sidebar {
			position: static;
			width: 100%;
			height: auto;
			flex: none;
			border-right: 0;
			border-bottom: 1px solid rgba(137, 158, 191, 0.16);
		}

		.brand {
			padding-bottom: 20px;
		}

		nav {
			grid-template-columns: repeat(2, minmax(0, 1fr));
			padding-bottom: 22px;
		}

		nav.has-dev-shortcut {
			grid-template-columns: repeat(3, minmax(0, 1fr));
		}

		nav a {
			justify-content: center;
			min-height: 46px;
			padding: 0 8px;
			font-size: 0.86rem;
		}

		nav a.dev-shortcut {
			gap: 8px;
		}

		nav a.dev-shortcut em {
			margin-left: 0;
			padding: 3px 5px;
			font-size: 0.56rem;
		}

		nav span {
			display: none;
		}
	}

	@media (max-width: 560px) {
		nav {
			display: flex;
			overflow-x: auto;
		}

		nav a {
			min-width: max-content;
			padding: 0 16px;
		}
	}
</style>

