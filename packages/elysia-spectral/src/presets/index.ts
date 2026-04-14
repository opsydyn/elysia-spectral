import type { RulesetDefinition } from '@stoplight/spectral-core';
import type { PresetName } from '../types';
import { recommended } from './recommended';
import { server } from './server';
import { strict } from './strict';

export { recommended } from './recommended';
export { server } from './server';
export { strict } from './strict';

export const presets: Record<PresetName, RulesetDefinition> = {
  recommended,
  server,
  strict,
};
