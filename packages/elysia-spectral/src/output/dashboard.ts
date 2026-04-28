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

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>OpenAPI Lint Dashboard</title>
<style>${styles}</style>
</head>
<body>
<header>
  <h1>OpenAPI Lint</h1>
  <a class="refresh" href="${escapeAttr(refreshPath)}?fresh=1">Re-run</a>
</header>
<main>${body}</main>
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
    ? `<div class="banner banner-pass"><strong>Pass</strong> at threshold "${escapeText(threshold)}"</div>`
    : `<div class="banner banner-fail"><strong>Fail</strong> at threshold "${escapeText(threshold)}"</div>`;

  const meta = `
<dl class="meta">
  <div><dt>Generated</dt><dd>${escapeText(result.generatedAt)}</dd></div>
  <div><dt>Source</dt><dd>${escapeText(result.source)}</dd></div>
  <div><dt>Duration</dt><dd>${result.durationMs ?? '—'} ms</dd></div>
  <div><dt>Cached</dt><dd>${cached ? 'yes' : 'no'}</dd></div>
</dl>`;

  const summary = `
<ul class="summary">
  <li class="sev-error"><span>${result.summary.error}</span> error</li>
  <li class="sev-warn"><span>${result.summary.warn}</span> warn</li>
  <li class="sev-info"><span>${result.summary.info}</span> info</li>
  <li class="sev-hint"><span>${result.summary.hint}</span> hint</li>
  <li class="sev-total"><span>${result.summary.total}</span> total</li>
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
        `<li><code>${escapeText(key)}</code><span>${escapeText(String(value))}</span></li>`,
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

      return `<tr class="sev-${finding.severity}">
  <td><span class="badge">${finding.severity}</span></td>
  <td><code>${escapeText(finding.code)}</code></td>
  <td>${escapeText(operation)}</td>
  <td>${escapeText(finding.message)}${recommendation}<code class="pointer">${escapeText(finding.documentPointer ?? '')}</code></td>
</tr>`;
    })
    .join('');

  return `<section><h2>Findings (${findings.length})</h2>
<table>
  <thead><tr><th>Severity</th><th>Rule</th><th>Operation</th><th>Detail</th></tr></thead>
  <tbody>${rows}</tbody>
</table>
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
:root { color-scheme: light dark; --bg:#0b0d10; --fg:#e6e6e6; --muted:#8a93a0; --line:#1f242b; --pass:#3ddc97; --fail:#ff5d5d; --warn:#f5a623; --info:#5dade2; --hint:#bdc3c7; }
@media (prefers-color-scheme: light) { :root { --bg:#fafafa; --fg:#1a1a1a; --muted:#6b7380; --line:#e3e6eb; } }
* { box-sizing: border-box; }
body { margin:0; font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif; background:var(--bg); color:var(--fg); }
header { display:flex; align-items:center; justify-content:space-between; padding:16px 24px; border-bottom:1px solid var(--line); }
h1 { margin:0; font-size:18px; font-weight:600; }
.refresh { color:var(--fg); text-decoration:none; padding:6px 12px; border:1px solid var(--line); border-radius:6px; font-size:13px; }
.refresh:hover { border-color:var(--muted); }
main { padding:24px; max-width:1100px; margin:0 auto; }
.banner { padding:12px 16px; border-radius:8px; margin-bottom:16px; }
.banner-pass { background: color-mix(in srgb, var(--pass) 18%, transparent); border:1px solid var(--pass); }
.banner-fail { background: color-mix(in srgb, var(--fail) 18%, transparent); border:1px solid var(--fail); }
.meta { display:grid; grid-template-columns: repeat(auto-fit, minmax(160px,1fr)); gap:8px; margin:0 0 16px; padding:0; }
.meta div { background:transparent; border:1px solid var(--line); border-radius:6px; padding:8px 12px; }
.meta dt { color:var(--muted); font-size:11px; text-transform:uppercase; letter-spacing:.04em; margin-bottom:4px; }
.meta dd { margin:0; font-size:14px; }
.summary { list-style:none; padding:0; margin:0 0 24px; display:flex; gap:8px; flex-wrap:wrap; }
.summary li { padding:8px 12px; border:1px solid var(--line); border-radius:6px; font-size:13px; color:var(--muted); }
.summary li span { color:var(--fg); font-weight:600; margin-right:6px; }
.summary .sev-error span { color:var(--fail); }
.summary .sev-warn span { color:var(--warn); }
.summary .sev-info span { color:var(--info); }
section { margin-top:24px; }
h2 { font-size:14px; text-transform:uppercase; letter-spacing:.05em; color:var(--muted); margin:0 0 12px; }
.artifacts { list-style:none; padding:0; margin:0; }
.artifacts li { display:flex; gap:12px; padding:6px 0; border-bottom:1px solid var(--line); font-size:13px; }
.artifacts code { color:var(--muted); min-width:160px; }
table { width:100%; border-collapse:collapse; font-size:13px; }
th, td { text-align:left; padding:8px 12px; border-bottom:1px solid var(--line); vertical-align:top; }
th { color:var(--muted); font-weight:500; font-size:11px; text-transform:uppercase; letter-spacing:.04em; }
.badge { display:inline-block; padding:2px 8px; border-radius:4px; font-size:11px; text-transform:uppercase; letter-spacing:.04em; }
.sev-error .badge { background: color-mix(in srgb, var(--fail) 22%, transparent); color:var(--fail); }
.sev-warn .badge { background: color-mix(in srgb, var(--warn) 22%, transparent); color:var(--warn); }
.sev-info .badge { background: color-mix(in srgb, var(--info) 22%, transparent); color:var(--info); }
.sev-hint .badge { background: color-mix(in srgb, var(--hint) 22%, transparent); color:var(--hint); }
.recommendation { margin:4px 0 0; color:var(--muted); font-size:12px; }
.pointer { display:block; margin-top:4px; color:var(--muted); font-size:11px; }
.empty { color:var(--muted); font-size:13px; }
`;
