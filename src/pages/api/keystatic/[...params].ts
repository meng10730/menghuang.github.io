import { makeAPIRouteHandler } from '@keystatic/astro/api';
import keystaticConfig from '../../../keystatic.config';

export const all = makeAPIRouteHandler({
  config: keystaticConfig,
});

export const prerender = false;
