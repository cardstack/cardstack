import sentryTestkit from 'sentry-testkit';
import * as Sentry from '@sentry/node';
import waitFor from '../utils/wait-for';
import { Suite } from 'mocha';

const { testkit, sentryTransport } = sentryTestkit();
const DUMMY_DSN = 'https://acacaeaccacacacabcaacdacdacadaca@sentry.io/000001';

let sentryNeedsInit = true;

export function setupSentry(context: Suite) {
  // Only call Sentry.init once to prevent memory leaks
  if (sentryNeedsInit) {
    context.beforeAll(function () {
      Sentry.init({
        dsn: DUMMY_DSN,
        release: 'test',
        tracesSampleRate: 1,
        transport: sentryTransport,
      });
    });

    sentryNeedsInit = false;
  }

  context.beforeEach(function () {
    testkit.reset();
  });
}

export async function waitForSentryReport() {
  await waitFor(() => testkit.reports().length > 0);
  return testkit.reports()[0];
}

export async function waitForSentryReports(timeout: number) {
  await waitFor(() => {
    return !!testkit.reports().length;
  }, timeout);
  return testkit.reports();
}
