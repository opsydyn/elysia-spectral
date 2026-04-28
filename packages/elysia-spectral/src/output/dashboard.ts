import type { LintFinding, LintRunResult, SeverityThreshold } from '../types';

export type DashboardRenderInput = {
  result: LintRunResult | null;
  threshold: SeverityThreshold;
  cached: boolean;
  error?: string;
  refreshPath: string;
};

export const renderDashboard = (input: DashboardRenderInput): string => {
  const { result, threshold, cached, error, refreshPath } = input;

  const body =
    error && !result
      ? renderError(error)
      : result
        ? renderReport(result, threshold, cached)
        : renderEmpty();

  const refreshHref = `${escapeAttr(refreshPath)}?fresh=1`;

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>Elysia Spectral Lint Dashboard</title>
<style>${styles}</style>
</head>
<body>
<header>
  <div class="brand">
    <span class="dot" aria-hidden="true"></span>
    <h1>Elysia Spectral Lint</h1>
  </div>
  <div class="actions">
    <kbd title="Press r to re-run">r</kbd>
    <a class="refresh" href="${refreshHref}" data-refresh>Re-run</a>
  </div>
</header>
<main>${body}</main>
<script>${script}</script>
</body>
</html>`;
};

const renderEmpty = (): string =>
  `<p class="empty">No lint result yet. <a href="?fresh=1">Run now</a>.</p>`;

const renderError = (message: string): string =>
  `<div class="banner banner-fail"><strong>Lint runtime error</strong><p>${escapeText(message)}</p></div>`;

const renderReport = (
  result: LintRunResult,
  threshold: SeverityThreshold,
  cached: boolean,
): string => {
  const banner = result.ok
    ? `<div class="banner banner-pass"><strong>Pass</strong> at threshold "${escapeText(threshold)}"<span class="tagline">SPEC IS TIGHT, SHIP IT RIGHT</span></div>`
    : `<div class="banner banner-fail"><strong>Fail</strong> at threshold "${escapeText(threshold)}"</div>`;

  const meta = `
<dl class="meta">
  <div><dt>Generated</dt><dd>${escapeText(result.generatedAt)}<span class="muted-line" data-relative-time="${escapeAttr(result.generatedAt)}"></span></dd></div>
  <div><dt>Source</dt><dd>${escapeText(result.source)}</dd></div>
  <div><dt>Duration</dt><dd>${result.durationMs ?? '—'} ms</dd></div>
  <div><dt>Cached</dt><dd>${cached ? 'yes' : 'no'}</dd></div>
</dl>`;

  const summary = `
<ul class="summary" data-filter-bar>
  <li class="sev-all is-active" data-filter="all" tabindex="0"><span>${result.summary.total}</span> total</li>
  <li class="sev-error" data-filter="error" tabindex="0"><span>${result.summary.error}</span> error</li>
  <li class="sev-warn" data-filter="warn" tabindex="0"><span>${result.summary.warn}</span> warn</li>
  <li class="sev-info" data-filter="info" tabindex="0"><span>${result.summary.info}</span> info</li>
  <li class="sev-hint" data-filter="hint" tabindex="0"><span>${result.summary.hint}</span> hint</li>
</ul>`;

  const artifacts = renderArtifacts(result.artifacts);
  const findings = renderFindings(result.findings);

  return `${banner}${meta}${summary}${artifacts}${findings}`;
};

const renderArtifacts = (
  artifacts: LintRunResult['artifacts'],
): string => {
  if (!artifacts || Object.keys(artifacts).length === 0) {
    return '';
  }

  const rows = Object.entries(artifacts)
    .map(
      ([key, value]) =>
        `<li><code>${escapeText(key)}</code><span class="path">${escapeText(String(value))}</span><button class="copy" type="button" data-copy="${escapeAttr(String(value))}" title="Copy path">copy</button></li>`,
    )
    .join('');

  return `<section><h2>Artifacts</h2><ul class="artifacts">${rows}</ul></section>`;
};

const renderFindings = (findings: LintFinding[]): string => {
  if (findings.length === 0) {
    return `<section><h2>Findings</h2><p class="empty">No findings.</p></section>`;
  }

  const rows = findings
    .map((finding) => {
      const operation =
        finding.operation?.method && finding.operation?.path
          ? `${finding.operation.method.toUpperCase()} ${finding.operation.path}`
          : '—';
      const recommendation = finding.recommendation
        ? `<p class="recommendation">${escapeText(finding.recommendation)}</p>`
        : '';
      const haystack = [
        finding.code,
        finding.message,
        operation,
        finding.documentPointer ?? '',
      ]
        .join(' ')
        .toLowerCase();

      return `<tr class="sev-${finding.severity}" data-severity="${escapeAttr(finding.severity)}" data-haystack="${escapeAttr(haystack)}">
  <td><span class="badge">${finding.severity}</span></td>
  <td><code>${escapeText(finding.code)}</code></td>
  <td>${escapeText(operation)}</td>
  <td>${escapeText(finding.message)}${recommendation}<code class="pointer">${escapeText(finding.documentPointer ?? '')}</code></td>
</tr>`;
    })
    .join('');

  return `<section>
<div class="findings-head">
  <h2>Findings (${findings.length})</h2>
  <input type="search" data-search placeholder="Filter rule, path, message…" aria-label="Filter findings" />
</div>
<table>
  <thead><tr><th>Severity</th><th>Rule</th><th>Operation</th><th>Detail</th></tr></thead>
  <tbody data-findings>${rows}</tbody>
</table>
<p class="empty hidden" data-empty-findings>No findings match the current filter.</p>
</section>`;
};

const escapeText = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const escapeAttr = escapeText;

const styles = `
:root { color-scheme: light dark; --bg:#0b0d10; --fg:#e6e6e6; --muted:#8a93a0; --line:#1f242b; --surface:#11151a; --pass:#3ddc97; --fail:#ff5d5d; --warn:#f5a623; --info:#5dade2; --hint:#bdc3c7; --mono: ui-monospace, SFMono-Regular, "JetBrains Mono", Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace; }
@media (prefers-color-scheme: light) { :root { --bg:#fafafa; --fg:#1a1a1a; --muted:#6b7380; --line:#e3e6eb; --surface:#ffffff; } }
* { box-sizing: border-box; }
body { margin:0; font-family: var(--mono); font-feature-settings: "calt" 0, "liga" 0, "ss01"; background:var(--bg); color:var(--fg); font-size:13px; line-height:1.5; }
header { position:sticky; top:0; z-index:10; display:flex; align-items:center; justify-content:space-between; padding:12px 24px; border-bottom:1px solid var(--line); background:color-mix(in srgb, var(--bg) 92%, transparent); backdrop-filter: blur(8px); }
.brand { display:flex; align-items:center; gap:10px; }
.dot { width:8px; height:8px; border-radius:50%; background:var(--pass); box-shadow:0 0 0 3px color-mix(in srgb, var(--pass) 25%, transparent); }
h1 { margin:0; font-size:13px; font-weight:600; letter-spacing:.02em; text-transform:uppercase; }
.actions { display:flex; align-items:center; gap:10px; }
kbd { font-family:var(--mono); font-size:11px; padding:2px 6px; border:1px solid var(--line); border-bottom-width:2px; border-radius:4px; color:var(--muted); background:var(--surface); }
.refresh { color:var(--fg); text-decoration:none; padding:6px 12px; border:1px solid var(--line); border-radius:6px; font-size:12px; font-family:var(--mono); background:var(--surface); transition:border-color .15s, transform .05s; }
.refresh:hover { border-color:var(--muted); }
.refresh:active { transform: translateY(1px); }
main { padding:24px; max-width:1100px; margin:0 auto; }
.banner { padding:12px 16px; border-radius:8px; margin-bottom:16px; font-size:13px; }
.banner-pass { background: color-mix(in srgb, var(--pass) 14%, transparent); border:1px solid color-mix(in srgb, var(--pass) 60%, var(--line)); }
.banner-fail { background: color-mix(in srgb, var(--fail) 14%, transparent); border:1px solid color-mix(in srgb, var(--fail) 60%, var(--line)); }
.tagline { display:block; margin-top:6px; font-weight:700; letter-spacing:.12em; color:var(--pass); text-transform:uppercase; font-size:11px; }
.meta { display:grid; grid-template-columns: repeat(auto-fit, minmax(180px,1fr)); gap:8px; margin:0 0 16px; padding:0; }
.meta div { background:var(--surface); border:1px solid var(--line); border-radius:6px; padding:8px 12px; }
.meta dt { color:var(--muted); font-size:10px; text-transform:uppercase; letter-spacing:.06em; margin-bottom:4px; }
.meta dd { margin:0; font-size:12px; }
.muted-line { display:block; color:var(--muted); font-size:11px; margin-top:2px; }
.summary { list-style:none; padding:0; margin:0 0 24px; display:flex; gap:6px; flex-wrap:wrap; }
.summary li { padding:6px 12px; border:1px solid var(--line); border-radius:999px; font-size:12px; color:var(--muted); cursor:pointer; user-select:none; transition:border-color .12s, background .12s; }
.summary li:hover { border-color:var(--muted); }
.summary li:focus { outline:2px solid color-mix(in srgb, var(--info) 60%, transparent); outline-offset:2px; }
.summary li.is-active { background: color-mix(in srgb, var(--fg) 8%, transparent); border-color:var(--muted); color:var(--fg); }
.summary li span { color:var(--fg); font-weight:600; margin-right:6px; }
.summary .sev-error span { color:var(--fail); }
.summary .sev-warn span { color:var(--warn); }
.summary .sev-info span { color:var(--info); }
section { margin-top:24px; }
h2 { font-size:11px; text-transform:uppercase; letter-spacing:.06em; color:var(--muted); margin:0 0 12px; font-weight:600; }
.findings-head { display:flex; align-items:center; justify-content:space-between; gap:12px; margin-bottom:8px; }
.findings-head h2 { margin:0; }
[data-search] { font-family:var(--mono); font-size:12px; padding:6px 10px; min-width:240px; background:var(--surface); color:var(--fg); border:1px solid var(--line); border-radius:6px; }
[data-search]:focus { outline:none; border-color:var(--muted); }
.artifacts { list-style:none; padding:0; margin:0; }
.artifacts li { display:flex; align-items:center; gap:12px; padding:6px 0; border-bottom:1px solid var(--line); font-size:12px; }
.artifacts code { color:var(--muted); min-width:160px; }
.artifacts .path { flex:1; word-break:break-all; }
.copy { font-family:var(--mono); font-size:11px; padding:2px 8px; border:1px solid var(--line); background:var(--surface); color:var(--muted); border-radius:4px; cursor:pointer; }
.copy:hover { color:var(--fg); border-color:var(--muted); }
.copy.copied { color:var(--pass); border-color:var(--pass); }
table { width:100%; border-collapse:collapse; font-size:12px; }
th, td { text-align:left; padding:8px 12px; border-bottom:1px solid var(--line); vertical-align:top; }
th { color:var(--muted); font-weight:500; font-size:10px; text-transform:uppercase; letter-spacing:.06em; }
tbody tr:hover { background: color-mix(in srgb, var(--fg) 4%, transparent); }
tr.is-hidden { display:none; }
.badge { display:inline-block; padding:2px 8px; border-radius:4px; font-size:10px; text-transform:uppercase; letter-spacing:.06em; font-family:var(--mono); }
.sev-error .badge { background: color-mix(in srgb, var(--fail) 22%, transparent); color:var(--fail); }
.sev-warn .badge { background: color-mix(in srgb, var(--warn) 22%, transparent); color:var(--warn); }
.sev-info .badge { background: color-mix(in srgb, var(--info) 22%, transparent); color:var(--info); }
.sev-hint .badge { background: color-mix(in srgb, var(--hint) 22%, transparent); color:var(--hint); }
.recommendation { margin:4px 0 0; color:var(--muted); font-size:11px; }
.pointer { display:block; margin-top:4px; color:var(--muted); font-size:11px; }
.empty { color:var(--muted); font-size:12px; }
.hidden { display:none; }
`;

const script = `
(() => {
  const rel = (iso) => {
    const t = Date.parse(iso); if (Number.isNaN(t)) return '';
    const s = Math.round((Date.now() - t) / 1000);
    if (s < 60) return s + 's ago';
    if (s < 3600) return Math.round(s/60) + 'm ago';
    if (s < 86400) return Math.round(s/3600) + 'h ago';
    return Math.round(s/86400) + 'd ago';
  };
  for (const el of document.querySelectorAll('[data-relative-time]')) {
    el.textContent = rel(el.getAttribute('data-relative-time'));
  }

  const rows = Array.from(document.querySelectorAll('[data-findings] tr'));
  const search = document.querySelector('[data-search]');
  const empty = document.querySelector('[data-empty-findings]');
  const chips = Array.from(document.querySelectorAll('[data-filter]'));
  let activeSeverity = 'all';
  let query = '';

  const apply = () => {
    let visible = 0;
    for (const tr of rows) {
      const sev = tr.getAttribute('data-severity');
      const hay = tr.getAttribute('data-haystack') || '';
      const sevOk = activeSeverity === 'all' || sev === activeSeverity;
      const qOk = !query || hay.includes(query);
      const show = sevOk && qOk;
      tr.classList.toggle('is-hidden', !show);
      if (show) visible += 1;
    }
    if (empty) empty.classList.toggle('hidden', visible !== 0 || rows.length === 0);
  };

  for (const chip of chips) {
    const select = () => {
      activeSeverity = chip.getAttribute('data-filter') || 'all';
      for (const c of chips) c.classList.toggle('is-active', c === chip);
      apply();
    };
    chip.addEventListener('click', select);
    chip.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); select(); } });
  }

  if (search) {
    search.addEventListener('input', () => { query = search.value.trim().toLowerCase(); apply(); });
  }

  for (const btn of document.querySelectorAll('[data-copy]')) {
    btn.addEventListener('click', async () => {
      const value = btn.getAttribute('data-copy') || '';
      try { await navigator.clipboard.writeText(value); btn.classList.add('copied'); btn.textContent = 'copied'; setTimeout(() => { btn.classList.remove('copied'); btn.textContent = 'copy'; }, 1200); } catch {}
    });
  }

  document.addEventListener('keydown', (e) => {
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
    if (e.key === 'r') { const link = document.querySelector('[data-refresh]'); if (link) link.click(); }
    if (e.key === '/' && search) { e.preventDefault(); search.focus(); }
  });
})();
`;
