import type { LintFinding, LintRunResult, SeverityThreshold } from '../types';
import dashboardScript from './dashboard.client.js' with { type: 'text' };
import dashboardStyles from './dashboard.css' with { type: 'text' };

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
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bangers&family=IBM+Plex+Mono:wght@400;500;600;700&display=swap" />
<style>${dashboardStyles}</style>
</head>
<body>
<header>
  <div class="brand">
    <span class="dot" aria-hidden="true"></span>
    <h1>Elysia Spectral Lint</h1>
  </div>
  <div class="actions">
    <label class="theme-switch" title="Switch dashboard theme">
      <span class="theme-label">Theme</span>
      <select data-theme-switcher aria-label="Dashboard theme">
        <option value="astro">Astro Houston</option>
        <option value="tron">Tron Legacy</option>
        <option value="808">Detroit 808</option>
      </select>
    </label>
    <kbd title="Press r to re-run">r</kbd>
    <a class="refresh" href="${refreshHref}" data-refresh>Re-run</a>
  </div>
</header>
<main>${body}</main>
<script>${dashboardScript}</script>
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

const renderArtifacts = (artifacts: LintRunResult['artifacts']): string => {
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
