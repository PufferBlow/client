import { useEffect } from 'react';
import { useNavigate } from 'react-router';
import { parseDeepLink } from '../services/deepLink';
import { logger } from '../utils/logger';

/**
 * Subset of `window.electron` we depend on. Declared locally to avoid
 * threading a global ambient type across the codebase — every Electron
 * consumer in `app/` follows this same pattern.
 */
interface ElectronBridge {
  onDeepLink?: (cb: (url: string) => void) => () => void;
  getPendingDeepLink?: () => Promise<string | null>;
}

const getBridge = (): ElectronBridge | undefined => {
  if (typeof window === 'undefined') return undefined;
  return (window as unknown as { electron?: ElectronBridge }).electron;
};

/**
 * Listens for `pufferblow://` activations forwarded by the Electron main
 * process and navigates the app to the matching route.
 *
 * Two entry points are wired:
 *   1. `onDeepLink` — live activations while the app is already running
 *      (second-instance argv on Windows/Linux, open-url on macOS).
 *   2. `getPendingDeepLink` — cold-start activations queued before the
 *      renderer had mounted. Drained exactly once on first render.
 *
 * No-op in plain-browser builds. The component renders nothing.
 */
export function DeepLinkRouter() {
  const navigate = useNavigate();

  useEffect(() => {
    const bridge = getBridge();
    if (!bridge) return;

    const route = (url: string) => {
      const path = parseDeepLink(url);
      if (!path) {
        logger.ui.warn('DeepLinkRouter: unrecognized URL, ignoring', { url });
        return;
      }
      logger.ui.info('DeepLinkRouter: routing', { url, path });
      navigate(path);
    };

    // Drain any URL the OS handed us before this mount.
    bridge.getPendingDeepLink?.().then((url) => {
      if (url) route(url);
    });

    // Subscribe to live activations while the app is running.
    const dispose = bridge.onDeepLink?.((url) => {
      route(url);
    });

    return () => {
      dispose?.();
    };
  }, [navigate]);

  return null;
}
