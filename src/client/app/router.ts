import { useCallback, useEffect, useMemo, useRef } from 'react';
import {
  useHref as _useHref,
  useLocation as _useLocation,
  useMatch as _useMatch,
  useNavigate as _useNavigate,
  NavigateFunction,
  matchPath,
  resolvePath,
} from 'react-router-dom';
import { resolveURL } from 'ufo';
import { hasIslands, isBrowser } from './constants.js';

function warn(api: string, extraMsg?: string) {
  if (!import.meta.env.PROD && isBrowser) {
    const msg = `[servite] using ${api}() in islands may have unexpected results.${
      extraMsg ? ` ${extraMsg}` : ''
    }`;
    // eslint-disable-next-line no-console
    console.warn(msg);

    try {
      throw new Error(
        'This error is thrown so that you can more easily find the source of the above warning'
      );
      // eslint-disable-next-line no-empty
    } catch (e) {}
  }
}

/**
 * Returns the full href for the given "to" value.
 *
 * @see https://reactrouter.com/docs/en/v6/api#usehref
 */
export const useHref: typeof _useHref = to => {
  if (hasIslands) {
    // warn('useHref');
    // eslint-disable-next-line react-hooks/rules-of-hooks
    return useMemo(() => {
      const { pathname, search, hash } = resolvePath(
        to,
        window.location.pathname
      );
      return new URL(resolveURL(pathname, search, hash)).href;
    }, [to]);
  }

  return _useHref(to);
};

/**
 * Returns the current location object, which represents the current URL in web
 * browsers.
 *
 * @see https://reactrouter.com/docs/en/v6/api#uselocation
 */
export const useLocation: typeof _useLocation = () => {
  if (hasIslands) {
    // warn('useLocation', 'It will always return `window.location`');
    // eslint-disable-next-line react-hooks/rules-of-hooks
    return useMemo(() => ({ ...window.location, state: null, key: '' }), []);
  }
  return _useLocation();
};

/**
 * Returns true if the URL for the given "to" value matches the current URL.
 * This is useful for components that need to know "active" state, e.g.
 * <NavLink>.
 *
 * @see https://reactrouter.com/docs/en/v6/api#usematch
 */
export const useMatch: typeof _useMatch = pattern => {
  if (hasIslands) {
    // warn('useMatch', 'It will run matchPath() with `window.location.pathname`');
    // eslint-disable-next-line react-hooks/rules-of-hooks
    return useMemo(
      () => matchPath(pattern, window.location.pathname),
      [pattern]
    );
  }
  return _useMatch(pattern);
};

/**
 * Returns an imperative method for changing the location. Used by <Link>s, but
 * may also be used by other elements to change the location.
 *
 * @see https://reactrouter.com/docs/en/v6/api#usenavigate
 */
export const useNavigate: typeof _useNavigate = () => {
  const activeRef = useRef(false);

  useEffect(() => {
    activeRef.current = true;
  });

  if (hasIslands) {
    // eslint-disable-next-line react-hooks/rules-of-hooks, react-hooks/exhaustive-deps
    return useCallback(
      ((to, options) => {
        if (!activeRef.current) {
          return;
        }

        if (typeof to === 'number') {
          window.history.go(to);
          return;
        }

        const { pathname, search, hash } = resolvePath(
          to,
          window.location.pathname
        );

        (options?.replace
          ? window.history.replaceState
          : window.history.pushState)(
          options?.state,
          '',
          resolveURL(pathname, search, hash)
        );
      }) as NavigateFunction,
      []
    );
  }

  return _useNavigate();
};
