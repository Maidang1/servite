import assert from 'assert';
import { ServiteConfig, UserServiteConfig } from './types.js';

export function resolveServiteConfig(
  userServiteConfig: UserServiteConfig = {}
): ServiteConfig {
  const {
    pagesDirs = [{ dir: 'src/pages' }],
    ssr = true,
    ssg = true,
    hashRouter = false,
    ...rest
  } = userServiteConfig;

  assert(pagesDirs.length, 'pagesDirs is empty');

  return {
    ...rest,
    pagesDirs,
    ssr,
    ssg,
    hashRouter,
  };
}
