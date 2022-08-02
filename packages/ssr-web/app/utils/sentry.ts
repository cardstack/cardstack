import * as WebSentry from '@sentry/ember';

/**
 * This initializes Sentry for web, if we're not in the FastBoot sandbox
 */
export function initSentry() {
  // @ts-ignore
  if (!globalThis.FastBoot) WebSentry.init();
  else
    console.log(
      'In the FastBoot sandbox, not initializing sentry within Ember App'
    );
}

/**
 * Get the correct Sentry instance for the environment
 */
export function getSentry(): typeof WebSentry {
  // @ts-ignore
  if (globalThis.FastBoot) {
    // @ts-ignore
    return NodeSentry;
  } else {
    return WebSentry;
  }
}
