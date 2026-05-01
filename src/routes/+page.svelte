<script lang="ts">
    import { onMount } from "svelte";
    import AnalysisCard from "$lib/components/AnalysisCard.svelte";
    import ScoreBars from "$lib/components/ScoreBars.svelte";
    import ScoreRing from "$lib/components/ScoreRing.svelte";
    import Sidebar from "$lib/components/Sidebar.svelte";

    type AnalysisResult = {
        url?: string;
        intent?: string;
        score?: number;
        relevance?: number;
        clarity?: number;
        practicalValue?: number;
        noiseLevel?: number;
        humanValue?: number;
        summary?: string;
        strengths?: string[];
        weaknesses?: string[];
        improvements?: string[];
        category?: string;
        topics?: string[];
        wordCount?: number;
        contentExtracted?: number;
    };

    const STORAGE_KEY = "veridict:last-analysis";

    let url = $state("");
    let loading = $state(false);
    let result = $state<AnalysisResult | null>(null);
    let error = $state("");
    let analyzedAt = $state<Date | null>(null);
    let restored = $state(false);

    const visibleResult = $derived(
        result ?? (loading ? createLoadingResult(url) : null),
    );
    const scoreItems = $derived([
        {
            label: "Relevance",
            value: Number(visibleResult?.relevance ?? 0),
            icon: "◎",
        },
        {
            label: "Clarity",
            value: Number(visibleResult?.clarity ?? 0),
            icon: "▱",
        },
        {
            label: "Practical Value",
            value: Number(visibleResult?.practicalValue ?? 0),
            icon: "◇",
        },
        {
            label: "Signal vs Noise",
            value: Number(visibleResult?.noiseLevel ?? 0),
            icon: "⌁",
            invert: true,
        },
    ]);

    const statusText = $derived(
        loading
            ? "Analysis in progress"
            : result
              ? "Analysis completed"
              : restored
                ? "Restored previous analysis"
                : "Ready",
    );
    const statusTime = $derived(
        analyzedAt ? formatRelative(analyzedAt) : "Waiting for URL",
    );

    function createLoadingResult(currentUrl: string): AnalysisResult {
        return {
            url: formatUrl(currentUrl || "https://tarot.hildenmedia.se"),
            score: Math.random() * 2 + 6,
            relevance: 8.4,
            clarity: 7.1,
            practicalValue: 7.8,
            noiseLevel: 5.6,
            summary:
                "Reading page structure, extracting content quality signals, and weighing practical value.",
            strengths: [],
            weaknesses: [],
            improvements: [],
            category: "Unknown",
        };
    }

    function formatUrl(value: string) {
        const trimmed = value.trim();
        if (!trimmed) return "";
        return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    }

    function formatRelative(date: Date) {
        const diffSeconds = Math.max(
            0,
            Math.floor((Date.now() - date.getTime()) / 1000),
        );
        if (diffSeconds < 45) return "Just now";
        const minutes = Math.floor(diffSeconds / 60);
        if (minutes < 60) return `${minutes} min ago`;
        const hours = Math.floor(minutes / 60);
        if (hours < 24) return `${hours} hr ago`;
        return date.toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
        });
    }

    function formatDate(date: Date | null) {
        if (!date) return "Not analyzed yet";
        return date.toLocaleString(undefined, {
            month: "long",
            day: "numeric",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        });
    }

    function formatHost(value?: string) {
        if (!value) return "Unknown";
        try {
            return new URL(value).hostname.replace(/^www\./, "");
        } catch {
            return (
                value
                    .replace(/^https?:\/\//, "")
                    .replace(/^www\./, "")
                    .split("/")[0] || value
            );
        }
    }

    function getWordCount(analysis: AnalysisResult | null) {
        const count = analysis?.wordCount ?? analysis?.contentExtracted;
        return typeof count === "number" && count > 0
            ? `${count.toLocaleString()} words`
            : "Unknown";
    }

    async function analyze() {
        if (!url.trim() || loading) return;

        const formattedUrl = formatUrl(url);
        loading = true;
        error = "";

        try {
            const res = await fetch("https://localhost:7032/analyze", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ url: formattedUrl }),
            });

            if (!res.ok) {
                throw new Error(`API returned ${res.status}`);
            }

            const data: AnalysisResult = await res.json();
            result = data;
            url = data.url ?? formattedUrl;
            analyzedAt = new Date();
            restored = false;

            localStorage.setItem(
                STORAGE_KEY,
                JSON.stringify({
                    url,
                    result,
                    analyzedAt: analyzedAt.toISOString(),
                }),
            );
        } catch (err) {
            error =
                "Something went wrong while analyzing this URL. Make sure the API is running and try again.";
        } finally {
            loading = false;
        }
    }

    function handleKeydown(event: KeyboardEvent) {
        if (event.key === "Enter" && !loading) {
            event.preventDefault();
            analyze();
        }
    }

    function getScoreLabel(score?: number) {
        if (!score) return "Analysis ready";
        if (score >= 8) return "High quality";
        if (score >= 6) return "Good quality with room to grow";
        if (score >= 4) return "Needs improvement";
        return "Low quality";
    }

    onMount(() => {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (!stored) return;

        try {
            const parsed = JSON.parse(stored);
            url = parsed.url ?? parsed.result?.url ?? "";
            result = parsed.result ?? null;
            analyzedAt = parsed.analyzedAt ? new Date(parsed.analyzedAt) : null;
            restored = Boolean(result);
        } catch {
            localStorage.removeItem(STORAGE_KEY);
        }
    });
</script>

<svelte:head>
    <title>Veridict | Analyze any website</title>
    <meta
        name="description"
        content="AI-powered website quality analysis based on relevance, clarity and practical value."
    />
</svelte:head>

<div class="app-shell">
    <Sidebar />

    <main class="workspace">
        <section class="content">
            <header class="hero">
                <div>
                    <h1>Analyze any website</h1>
                    <p>
                        AI-powered analysis based on quality, relevance and real
                        value — not SEO.
                    </p>
                </div>

                <form
                    class="analyze-form"
                    onsubmit={(event) => event.preventDefault()}
                >
                    <label class="url-field">
                        <span>◎</span>
                        <input
                            bind:value={url}
                            disabled={loading}
                            onkeydown={handleKeydown}
                            placeholder="Enter a website URL..."
                            type="url"
                        />
                    </label>

                    <button
                        class="analyze-button"
                        disabled={loading || !url.trim()}
                        onclick={analyze}
                        type="button"
                    >
                        <span>✣</span>
                        {loading ? "Analyzing..." : "Analyze"}
                    </button>
                </form>

                <div class="status-line" class:error-state={Boolean(error)}>
                    <span>{error ? "!" : loading ? "◌" : "✓"}</span>
                    <strong>{error || statusText}</strong>
                    <i>•</i>
                    <em>{statusTime}</em>
                </div>
            </header>

            {#if visibleResult}
                <section class="score-panel" class:loading>
                    <ScoreRing
                        score={Number(visibleResult.score ?? 0)}
                        {loading}
                    />

                    <div class="score-summary">
                        <h2>
                            <span></span>{loading
                                ? "Analyzing quality signals"
                                : getScoreLabel(visibleResult.score)}
                        </h2>
                        <p>{visibleResult.summary}</p>
                        <ScoreBars items={scoreItems} {loading} />
                    </div>
                </section>

                <section class="cards-grid">
                    <AnalysisCard
                        title="Strengths"
                        items={visibleResult.strengths ?? []}
                        variant="strengths"
                        {loading}
                    />
                    <AnalysisCard
                        title="Weaknesses"
                        items={visibleResult.weaknesses ?? []}
                        variant="weaknesses"
                        {loading}
                    />
                    <AnalysisCard
                        title="Improvements"
                        items={visibleResult.improvements ?? []}
                        variant="improvements"
                        {loading}
                    />
                </section>
            {:else}
                <section class="empty-state">
                    <div>
                        <span>✣</span>
                        <h2>Start with a URL</h2>
                        <p>
                            Paste a public website and Veridict will score its
                            content quality, clarity, practical value and signal
                            strength.
                        </p>
                    </div>
                </section>
            {/if}

            <footer class="notice">
                <span>✣</span>
                <p>
                    This analysis is AI-generated and based on our quality
                    methodology.
                    <br />
                    Site owners can claim their page to track improvements over time.
                </p>
                <a
                    href="https://hildenmedia.se"
                    target="_blank"
                    rel="noreferrer">Claim this site</a
                >
            </footer>
        </section>

        <aside class="right-rail">
            <section class="meta-panel">
                <div class="meta-list">
                    <div>
                        <span>◎ URL</span>
                        <strong>{formatHost(visibleResult?.url ?? url)}</strong>
                    </div>
                    <div>
                        <span>◷ Analyzed</span>
                        <strong>{formatDate(analyzedAt)}</strong>
                    </div>
                    <div>
                        <span>▣ Page Type</span>
                        <strong>{visibleResult?.category || "Unknown"}</strong>
                    </div>
                    <div>
                        <span>▤ Word Count</span>
                        <strong>{getWordCount(visibleResult)}</strong>
                    </div>
                    <div>
                        <span>AI Model</span>
                        <strong>gpt-4o</strong>
                    </div>
                    <div>
                        <span>✎ Analysis Type</span>
                        <strong>General Analysis</strong>
                    </div>
                </div>

                <div class="unbiased">
                    <span>♢</span>
                    <div>
                        <h2>Independent &amp; Unbiased</h2>
                        <p>
                            Our scores are based solely on content quality and
                            user value. No SEO, traffic or popularity factors
                            are used.
                        </p>
                    </div>
                </div>
            </section>
        </aside>
    </main>
</div>

<style>
    :global(*) {
        box-sizing: border-box;
    }

    :global(html) {
        min-width: 320px;
        background: #06101c;
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
        background: radial-gradient(
                circle at 38% 12%,
                rgba(38, 117, 161, 0.16),
                transparent 26%
            ),
            radial-gradient(
                circle at 80% 0%,
                rgba(99, 72, 255, 0.14),
                transparent 24%
            ),
            linear-gradient(180deg, #06101c 0%, #081522 52%, #07111d 100%);
        color: #edf4ff;
    }

    :global(button),
    :global(input) {
        font: inherit;
    }

    .app-shell {
        display: flex;
        min-height: 100vh;
    }

    .workspace {
        display: grid;
        width: 100%;
        grid-template-columns: minmax(0, 1fr) minmax(300px, 380px);
        gap: clamp(28px, 3vw, 52px);
        padding: 24px clamp(20px, 3vw, 40px) 28px 28px;
        align-items: start;
    }

    .content {
        display: grid;
        align-content: start;
        gap: 24px;
        min-width: 0;
    }

    .hero h1 {
        margin: 14px 0 10px;
        color: #ffffff;
        font-size: clamp(2.1rem, 3.2vw, 3rem);
        line-height: 1.06;
        letter-spacing: 0;
    }

    .hero p {
        margin: 0;
        color: #b9c4d6;
        font-size: 1.15rem;
    }

    .analyze-form {
        display: grid;
        grid-template-columns: minmax(0, 1fr) 160px;
        gap: 14px;
        margin-top: 38px;
    }

    .url-field {
        display: flex;
        align-items: center;
        min-height: 64px;
        gap: 18px;
        padding: 0 22px;
        border: 1px solid rgba(137, 158, 191, 0.32);
        border-radius: 12px;
        background: rgba(9, 21, 35, 0.8);
        box-shadow:
            inset 0 1px 0 rgba(255, 255, 255, 0.03),
            0 18px 35px rgba(0, 0, 0, 0.16);
        transition:
            border-color 180ms ease,
            box-shadow 180ms ease;
    }

    .url-field:focus-within {
        border-color: rgba(133, 114, 255, 0.84);
        box-shadow:
            0 0 0 4px rgba(111, 83, 255, 0.12),
            0 18px 35px rgba(0, 0, 0, 0.16);
    }

    .url-field span {
        color: #aab8cc;
        font-size: 1.45rem;
    }

    input {
        width: 100%;
        border: 0;
        outline: 0;
        background: transparent;
        color: #ffffff;
        font-size: 1.18rem;
    }

    input::placeholder {
        color: #ffffff;
        opacity: 0.92;
    }

    .analyze-button {
        display: flex;
        align-items: center;
        justify-content: center;
        min-height: 64px;
        gap: 10px;
        border: 0;
        border-radius: 12px;
        background: linear-gradient(
            125deg,
            #4d6aff 0%,
            #a557ff 52%,
            #18a8ff 100%
        );
        color: #ffffff;
        cursor: pointer;
        font-weight: 850;
        font-size: 1.08rem;
        box-shadow:
            0 18px 44px rgba(75, 100, 255, 0.38),
            0 0 36px rgba(151, 75, 255, 0.26);
        transition:
            transform 180ms ease,
            filter 180ms ease,
            opacity 180ms ease;
    }

    .analyze-button:hover:not(:disabled) {
        filter: brightness(1.08);
        transform: translateY(-1px);
    }

    .analyze-button:disabled {
        cursor: not-allowed;
        opacity: 0.66;
    }

    .status-line {
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap: 10px;
        min-height: 28px;
        margin-top: 18px;
        color: #aeb9cb;
        line-height: 1.35;
    }

    .status-line span {
        color: #44fb79;
        font-weight: 900;
    }

    .status-line strong,
    .status-line em {
        font-size: 1rem;
        font-style: normal;
        font-weight: 500;
    }

    .status-line.error-state span,
    .status-line.error-state {
        color: #ff7786;
    }

    .status-line i {
        color: #536278;
        flex: 0 0 auto;
        font-style: normal;
    }

    .score-panel,
    .empty-state,
    .notice,
    .meta-panel {
        border: 1px solid rgba(130, 153, 188, 0.14);
        border-radius: 14px;
        background: radial-gradient(
                circle at 18% 26%,
                rgba(57, 119, 143, 0.16),
                transparent 32%
            ),
            linear-gradient(
                145deg,
                rgba(15, 30, 49, 0.9),
                rgba(7, 18, 31, 0.94)
            );
        box-shadow: 0 24px 70px rgba(0, 0, 0, 0.26);
    }

    .score-panel {
        display: grid;
        grid-template-columns: minmax(300px, 0.9fr) minmax(300px, 1.1fr);
        align-items: center;
        gap: clamp(30px, 4vw, 56px);
        min-height: 430px;
        padding: clamp(26px, 3vw, 42px);
        animation: panelIn 520ms ease both;
        position: relative;
        z-index: 2;
        overflow: hidden;
        margin-bottom: 8px;
    }

    .score-summary {
        display: grid;
        gap: 22px;
        min-width: 0;
    }

    .score-summary h2 {
        display: flex;
        align-items: center;
        gap: 12px;
        margin: 0;
        color: #ffffff;
        font-size: 1.32rem;
    }

    .score-summary h2 span {
        width: 13px;
        height: 13px;
        border-radius: 50%;
        background: #41e85e;
        box-shadow: 0 0 22px rgba(65, 232, 94, 0.62);
    }

    .score-summary p {
        max-width: 460px;
        margin: -8px 0 4px;
        color: #c4cedd;
        font-size: 1.02rem;
        line-height: 1.58;
    }

    .cards-grid {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: clamp(16px, 1.8vw, 22px);
        margin-top: 6px;
        align-items: stretch;
    }

    .empty-state {
        display: grid;
        min-height: 470px;
        place-items: center;
        padding: 48px;
        text-align: center;
    }

    .empty-state div {
        max-width: 520px;
    }

    .empty-state span {
        color: #9f77ff;
        font-size: 3rem;
    }

    .empty-state h2 {
        margin: 12px 0;
        color: #ffffff;
        font-size: 2rem;
    }

    .empty-state p {
        margin: 0;
        color: #b7c3d5;
        font-size: 1.05rem;
        line-height: 1.65;
    }

    .notice {
        display: grid;
        grid-template-columns: 34px 1fr auto;
        align-items: center;
        gap: 20px;
        padding: 24px 28px;
    }

    .notice span {
        color: #9e72ff;
        font-size: 1.8rem;
    }

    .notice p {
        margin: 0;
        color: #aeb9cb;
        line-height: 1.55;
    }

    .notice a {
        padding: 13px 24px;
        border: 1px solid rgba(142, 94, 255, 0.5);
        border-radius: 9px;
        color: #b985ff;
        font-weight: 800;
        text-decoration: none;
    }

    .right-rail {
        display: grid;
        align-content: start;
        gap: 12px;
        min-width: 0;
        position: relative;
        z-index: 0;
    }


    .meta-panel {
        overflow: hidden;
        position: relative;
        z-index: 2;
        margin-top: -18px;
    }

    .meta-list {
        display: grid;
        gap: 22px;
        padding: 32px 26px;
    }

    .meta-list div {
        display: grid;
        grid-template-columns: 1fr minmax(160px, auto);
        gap: 18px;
        align-items: center;
    }

    .meta-list span {
        color: #99a7bc;
        font-size: 1rem;
    }

    .meta-list strong {
        color: #f5f8ff;
        font-size: 1rem;
        font-weight: 650;
        text-align: right;
    }

    .unbiased {
        display: grid;
        grid-template-columns: 46px 1fr;
        gap: 18px;
        padding: 28px 26px;
        border-top: 1px solid rgba(130, 153, 188, 0.14);
    }

    .unbiased > span {
        display: grid;
        width: 46px;
        height: 46px;
        place-items: center;
        border: 1px solid rgba(134, 91, 255, 0.4);
        border-radius: 11px;
        background: rgba(111, 83, 255, 0.08);
        color: #9f79ff;
        font-size: 1.5rem;
    }

    .unbiased h2 {
        margin: 0 0 10px;
        color: #ffffff;
        font-size: 1.05rem;
    }

    .unbiased p {
        margin: 0;
        color: #b7c3d5;
        line-height: 1.65;
    }

    @keyframes panelIn {
        from {
            opacity: 0;
            transform: translateY(12px);
        }
        to {
            opacity: 1;
            transform: translateY(0);
        }
    }

    @media (max-width: 1460px) {
        .workspace {
            grid-template-columns: minmax(0, 1fr);
        }

        .right-rail {
            grid-template-columns: 1fr;
        }
    }

    @media (max-width: 1100px) {
        .score-panel,
        .cards-grid,
        .right-rail {
            grid-template-columns: 1fr;
        }

        .score-panel {
            grid-template-columns: 1fr;
            justify-items: center;
            text-align: left;
        }

        .score-summary {
            width: min(100%, 640px);
        }
    }

    @media (max-width: 980px) {
        .app-shell {
            display: block;
        }

        .workspace {
            padding: 28px 20px;
        }
    }

    @media (max-width: 680px) {
        .analyze-form,
        .notice,
        .meta-list div {
            grid-template-columns: 1fr;
        }

        .analyze-button {
            width: 100%;
        }

        .score-panel {
            padding: 24px 18px;
        }

        .notice a,
        .meta-list strong {
            text-align: left;
        }

        .tarot-deck {
            opacity: 0.48;
            right: -24px;
        }

        .status-line {
            display: grid;
            grid-template-columns: 18px minmax(0, 1fr);
            align-items: start;
        }

        .status-line i {
            display: none;
        }

        .status-line em {
            grid-column: 2;
        }
    }
</style>
