import { Job } from 'graphile-worker';
import { registry, setupHub } from '../helpers/server';
import { expect } from 'chai';
import { makeJobHelpers } from 'graphile-worker/dist/helpers';
import waitFor from '../utils/wait-for';
import * as Sentry from '@sentry/node';
import sentryTestkit from 'sentry-testkit';
import SubscribeEmail from '../../tasks/subscribe-email';

const { testkit, sentryTransport } = sentryTestkit();

// https://github.com/graphile/worker/blob/e3176eab42ada8f4f3718192bada776c22946583/__tests__/helpers.ts#L135
function makeMockJob(taskIdentifier: string): Job {
  const createdAt = new Date(Date.now() - 12345678);
  return {
    id: String(Math.floor(Math.random() * 4294967296)),
    queue_name: null,
    task_identifier: taskIdentifier,
    payload: {},
    priority: 0,
    run_at: new Date(Date.now() - Math.random() * 2000),
    attempts: 0,
    max_attempts: 25,
    last_error: null,
    created_at: createdAt,
    updated_at: createdAt,
    locked_at: null,
    locked_by: null,
    revision: 0,
    key: null,
    flags: null,
  };
}

let helpers = makeJobHelpers({}, makeMockJob('subscribe-email'), {
  withPgClient: () => {
    throw new Error('withPgClient is not implemented in test');
  },
});

class StubMailchimp {
  static lastSubscribed: string | null = null;
  static shouldThrow = false;

  async subscribe(email: string) {
    if (StubMailchimp.shouldThrow) throw new Error('intentional error during test');
    StubMailchimp.lastSubscribed = email;
  }
}

describe('SubscribeEmailTask', function () {
  let subject: SubscribeEmail;

  this.beforeAll(async function () {
    registry(this).register('mailchimp', StubMailchimp);
  });

  let { getContainer } = setupHub(this);

  this.beforeEach(async function () {
    StubMailchimp.lastSubscribed = null;
    StubMailchimp.shouldThrow = false;
    Sentry.init({
      dsn: 'https://acacaeaccacacacabcaacdacdacadaca@sentry.io/000001',
      release: 'test',
      tracesSampleRate: 1,
      transport: sentryTransport,
    });
    testkit.reset();
    subject = await getContainer().instantiate(SubscribeEmail);
  });

  it('will try to subscribe the provided email to the Mailchimp newsletter', async function () {
    await subject.perform({ email: 'anyone@test.test' }, helpers);

    expect(StubMailchimp.lastSubscribed).to.equal('anyone@test.test');
  });
  it('will throw the error and report to Sentry if an error happens while trying to subscribe', async function () {
    StubMailchimp.shouldThrow = true;

    await expect(subject.perform({ email: 'anyone@test.test' }, helpers)).to.be.rejectedWith(
      'intentional error during test'
    );

    await waitFor(() => testkit.reports().length > 0);

    let sentryReport = testkit.reports()[0];
    expect(sentryReport.error?.message).to.equal('intentional error during test');
    expect(sentryReport.tags).to.deep.equal({
      action: 'subscribe-email',
      alert: 'web-team',
    });
  });
});
