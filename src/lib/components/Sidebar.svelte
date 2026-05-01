<script lang="ts">
	const navItems = [
		{ label: "Analyze", icon: "⌂", active: true },
		{ label: "Search", icon: "⌕" },
		{ label: "History", icon: "◷" },
		{ label: "My Sites", icon: "▣" },
		{ label: "Settings", icon: "⚙" },
	];
</script>

<aside class="sidebar" aria-label="Primary navigation">
	<a class="brand" href="/" aria-label="Veridict home">
		<span class="veridict-mark"><i></i><b></b></span>
		<strong>Veridict</strong>
	</a>

	<nav>
		{#each navItems as item}
			<a class:active={item.active} href={item.active ? "/" : "#"}>
				<span>{item.icon}</span>
				{item.label}
			</a>
		{/each}
	</nav>

	<div class="sidebar-spacer"></div>

	<section class="upgrade">
		<span class="spark">✣</span>
		<h2>Unlock more power</h2>
		<ul>
			<li>Intent-based analysis</li>
			<li>Track improvements</li>
			<li>Priority updates</li>
			<li>And more...</li>
		</ul>
		<a href="https://hildenmedia.se">Upgrade now</a>
	</section>

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

	<div class="domain">
		<span>veridict.app</span>
		<div class="theme-toggle" aria-hidden="true"><i></i></div>
	</div>
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

	nav span {
		width: 22px;
		color: #9eb7ff;
		font-size: 1.25rem;
	}

	.sidebar-spacer {
		flex: 1;
	}

	.upgrade {
		margin: 24px 26px;
		padding: 24px 18px 18px;
		border: 1px solid rgba(111, 129, 255, 0.26);
		border-radius: 13px;
		background: radial-gradient(
				circle at 85% 8%,
				rgba(155, 91, 255, 0.54),
				transparent 42%
			),
			linear-gradient(
				150deg,
				rgba(16, 67, 112, 0.84),
				rgba(51, 37, 126, 0.88)
			);
		box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.08);
	}

	.spark {
		color: #a783ff;
		font-size: 1.55rem;
	}

	.upgrade h2 {
		margin: 18px 0 16px;
		color: #ffffff;
		font-size: 1.02rem;
	}

	.upgrade ul {
		display: grid;
		gap: 11px;
		margin: 0 0 22px;
		padding: 0;
		color: #e7efff;
		font-size: 0.83rem;
		list-style: none;
	}

	.upgrade li::before {
		content: "✓";
		margin-right: 10px;
		color: #6cffb0;
		font-weight: 900;
	}

	.upgrade a {
		display: grid;
		min-height: 48px;
		place-items: center;
		border-radius: 9px;
		background: linear-gradient(100deg, #4465ff, #a64cff 55%, #20a8ff);
		color: #ffffff;
		font-weight: 800;
		text-decoration: none;
		box-shadow: 0 14px 30px rgba(79, 99, 255, 0.3);
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

	.domain {
		display: grid;
		justify-items: center;
		gap: 18px;
		padding: 27px 0 28px;
		border-top: 1px solid rgba(137, 158, 191, 0.16);
		color: #9aa9bd;
	}

	.theme-toggle {
		position: relative;
		width: 60px;
		height: 24px;
		border-radius: 999px;
		background: rgba(115, 132, 170, 0.14);
	}

	.theme-toggle::before,
	.theme-toggle::after {
		position: absolute;
		top: 4px;
		color: #8494ac;
		font-size: 13px;
	}

	.theme-toggle::before {
		content: "☼";
		left: -20px;
	}

	.theme-toggle::after {
		content: "◐";
		right: -20px;
	}

	.theme-toggle i {
		position: absolute;
		top: 3px;
		right: 4px;
		width: 18px;
		height: 18px;
		border-radius: 50%;
		background: linear-gradient(135deg, #825aff, #b066ff);
		box-shadow: 0 0 14px rgba(143, 95, 255, 0.8);
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
			grid-template-columns: repeat(5, minmax(0, 1fr));
			padding-bottom: 22px;
		}

		nav a {
			justify-content: center;
			min-height: 46px;
			padding: 0 8px;
			font-size: 0.86rem;
		}

		nav span,
		.upgrade,
		.domain {
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
