import sentryTestkit from 'sentry-testkit';
import * as Sentry from '@sentry/node';
import waitFor from '../utils/wait-for';
import { Suite } from 'mocha';

const { testkit, sentryTransport } = sentryTestkit();
const DUMMY_DSN = 'https://acacaeaccacacacabcaacdacdacadaca@sentry.io/000001';

export function setupSentry(context: Suite) {
  context.beforeAll(function () {
    Sentry.init({
      dsn: DUMMY_DSN,
      release: 'test',
      tracesSampleRate: 1,
      transport: sentryTransport,
    });
  });

  context.beforeEach(function () {
    testkit.reset();
  });
}

export async function fetchSentryReport() {
  await waitFor(() => testkit.reports().length > 0);
  return testkit.reports()[0];
}

export async function fetchSentryReports(timeout: number) {
  await waitFor(() => {
    return !!testkit.reports().length;
  }, timeout);
  return testkit.reports();
}
