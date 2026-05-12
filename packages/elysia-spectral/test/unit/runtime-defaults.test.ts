import { describe, expect, it } from 'bun:test';
import { resolveStartupMode } from '../../src/core/runtime';

describe('resolveStartupMode', () => {
  it('defaults to enforce when no startup controls are configured', () => {
    expect(resolveStartupMode()).toBe('enforce');
    expect(resolveStartupMode({})).toBe('enforce');
  });

  it('keeps enabled: false as a backwards-compatible alias for startup.mode off', () => {
    expect(resolveStartupMode({ enabled: false })).toBe('off');
  });

  it('maps the legacy enabled function to enforce/off using process.env', () => {
    let receivedEnv: Record<string, string | undefined> | undefined;

    const disabledMode = resolveStartupMode({
      enabled: (env) => {
        receivedEnv = env;
        return false;
      },
    });

    expect(disabledMode).toBe('off');
    expect(receivedEnv).toBe(process.env);
    expect(resolveStartupMode({ enabled: () => true })).toBe('enforce');
  });

  it('gives startup.mode precedence over the legacy enabled option', () => {
    expect(
      resolveStartupMode({
        enabled: false,
        startup: { mode: 'report' },
      }),
    ).toBe('report');

    expect(
      resolveStartupMode({
        enabled: () => false,
        startup: { mode: 'enforce' },
      }),
    ).toBe('enforce');
  });
});
