import * as WebSentry from '@sentry/ember';
import Service from '@ember/service';
import Fastboot from 'ember-cli-fastboot/services/fastboot';
import { inject as service } from '@ember/service';

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
export function getSentry() {
  // @ts-ignore
  if (globalThis.FastBoot) {
    // @ts-ignore
    return NodeSentry;
  } else {
    return WebSentry;
  }
}

export default class SentryService extends Service {
  _sentry!: typeof WebSentry;
  @service declare fastboot: Fastboot;

  setup() {
    this._sentry = getSentry();
  }

  captureException: typeof WebSentry['captureException'] = (
    exception,
    captureContext
  ) => {
    return this._sentry.captureException(exception, captureContext);
  };

  addBreadcrumb: typeof WebSentry['addBreadcrumb'] = (breadcrumb) => {
    return this._sentry.addBreadcrumb(breadcrumb);
  };

  get Severity() {
    return this._sentry.Severity;
  }
}

// DO NOT DELETE: this is how TypeScript knows how to look up your services.
declare module '@ember/service' {
  interface Registry {
    sentry: SentryService;
  }
}
