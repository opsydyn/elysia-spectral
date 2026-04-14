import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { LintFinding, LintRunResult } from '../types';

const escapeXml = (value: string): string =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');

export const writeJunitReport = async (
  reportPath: string,
  result: LintRunResult,
): Promise<string> => {
  const resolvedPath = path.resolve(process.cwd(), reportPath);
  await mkdir(path.dirname(resolvedPath), { recursive: true });
  await writeFile(resolvedPath, `${buildJunitReport(result)}\n`, 'utf8');
  return resolvedPath;
};

export const buildJunitReport = (result: LintRunResult): string => {
  const testCases =
    result.findings.length === 0
      ? [buildPassingTestCase()]
      : result.findings.map((finding) => buildFailingTestCase(finding));

  const tests = testCases.length;
  const failures = result.findings.length;
  const timestamp = escapeXml(result.generatedAt);

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<testsuites tests="${tests}" failures="${failures}" errors="0" skipped="0" time="0">`,
    `  <testsuite name="OpenAPI lint" tests="${tests}" failures="${failures}" errors="0" skipped="0" time="0" timestamp="${timestamp}">`,
    ...testCases.map((testCase) => `    ${testCase}`),
    '  </testsuite>',
    '</testsuites>',
  ].join('\n');
};

const buildPassingTestCase = (): string =>
  '<testcase classname="openapi.lint" name="OpenAPI lint" time="0" />';

const buildFailingTestCase = (finding: LintFinding): string => {
  const className = escapeXml(
    finding.operation?.path
      ? `openapi${finding.operation.path.replaceAll('/', '.')}`
      : 'openapi.document',
  );
  const name = escapeXml(buildTestName(finding));
  const failureType = escapeXml(finding.severity);
  const failureMessage = escapeXml(finding.message);
  const body = escapeXml(buildFailureBody(finding));

  return [
    `<testcase classname="${className}" name="${name}" time="0">`,
    `      <failure type="${failureType}" message="${failureMessage}">${body}</failure>`,
    '    </testcase>',
  ].join('\n');
};

const buildTestName = (finding: LintFinding): string => {
  const rule = finding.code;
  const operation = finding.operation?.path
    ? `${finding.operation.method?.toUpperCase() ?? 'DOC'} ${finding.operation.path}`
    : 'document';

  return `${rule} ${operation}`;
};

const buildFailureBody = (finding: LintFinding): string => {
  const lines = [`Issue: ${finding.message}`];

  if (finding.recommendation) {
    lines.push(`Fix: ${finding.recommendation}`);
  }

  if (finding.documentPointer) {
    lines.push(`Spec: openapi.json#${finding.documentPointer}`);
  }

  return lines.join('\n');
};
