import React, { ComponentType, LazyExoticComponent } from 'react';

export type PreloadableComponent<T extends ComponentType<any>> = LazyExoticComponent<T> & {
  preload: () => Promise<{ default: T }>;
};

/**
 * Lazy loading helper with auto-retry on network failure and explicit preloading support.
 * Increases efficiency by downloading chunks on hover/idle and prevents mobile chunk failure crashes.
 */
export function lazyWithPreload<T extends ComponentType<any>>(
  factory: () => Promise<{ default: T }>,
  retries = 2,
  interval = 1000
): PreloadableComponent<T> {
  let promise: Promise<{ default: T }> | null = null;

  const loadWithRetry = (): Promise<{ default: T }> => {
    if (!promise) {
      promise = factory().catch((error) => {
        promise = null; // Clear so subsequent attempts can retry
        if (retries <= 0) {
          console.error('[LazyLoad] Failed to load component chunk after retries:', error);
          throw error;
        }
        return new Promise((resolve) => setTimeout(resolve, interval)).then(() =>
          lazyWithPreload(factory, retries - 1, interval).preload()
        );
      });
    }
    return promise;
  };

  const Component = React.lazy(loadWithRetry) as PreloadableComponent<T>;
  Component.preload = loadWithRetry;
  return Component;
}
