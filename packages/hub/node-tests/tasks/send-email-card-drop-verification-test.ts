import { Helpers, Job } from 'graphile-worker';
import { registry, setupHub } from '../helpers/server';
import { expect } from 'chai';
import { setupSentry, waitForSentryReport } from '../helpers/sentry';
import SendEmailCardDropVerification from '../../tasks/send-email-card-drop-verification';
import { makeJobHelpers } from 'graphile-worker/dist/helpers';
import EmailCardDropRequestsQueries from '../../queries/email-card-drop-requests';
import config from 'config';
import { EmailCardDropRequest } from '../../routes/email-card-drop-requests';

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

let helpers: Helpers = makeJobHelpers({}, makeMockJob('send-email-card-drop-verification'), {
  withPgClient: async () => {
    throw new Error('not implemented');
  },
});

class StubEmail {
  static shouldThrow = false;
  static lastSent: any = null;

  async send(email: any) {
    if (StubEmail.shouldThrow) throw new Error('Intentional error in stub email sending');
    StubEmail.lastSent = email;
  }
}

const cardDropRequest: EmailCardDropRequest = {
  id: '53a6cd14-ce63-47f0-baaa-0392e4f3d64a',
  ownerAddress: '0xnotClaimedAddress',
  emailHash: 'unclaimedhash',
  verificationCode: 'unclaimedverificationcode',
  requestedAt: new Date(),
};
const expiredCardDropRequest: EmailCardDropRequest = {
  id: 'f0535b7a-743b-4cda-aec2-1acaa1757582',
  ownerAddress: '0xexpiredAddress2',
  emailHash: 'expiredhash2',
  verificationCode: 'expiredverificationcode2',
  requestedAt: new Date(Date.now() - 61 * 60 * 1000),
};

describe('SendEmailCardDropVerificationTask', function () {
  this.beforeAll(function () {
    registry(this).register('email', StubEmail);
  });

  let { getContainer } = setupHub(this);
  setupSentry(this);
  this.beforeEach(async function () {
    StubEmail.shouldThrow = false;
    StubEmail.lastSent = null;
    let cardDropQueries = (await getContainer().lookup('email-card-drop-requests', {
      type: 'query',
    })) as EmailCardDropRequestsQueries;
    await cardDropQueries.insert(cardDropRequest);
    await cardDropQueries.insert(expiredCardDropRequest);
  });

  it('sends an email that contains the verification link', async function () {
    let task = (await getContainer().lookup('send-email-card-drop-verification')) as SendEmailCardDropVerification;
    let params = new URLSearchParams();
    params.append('eoa', cardDropRequest.ownerAddress);
    params.append('verification-code', cardDropRequest.verificationCode);
    params.append('email-hash', cardDropRequest.emailHash);
    let link = 'https://card-drop-email.test/email-card-drop/verify' + '?' + params.toString();

    await task.perform({ email: 'anyone@test.test', id: cardDropRequest.id }, helpers);

    expect(StubEmail.lastSent.to).to.equal('anyone@test.test');
    expect(StubEmail.lastSent.from).to.equal(config.get('aws.ses.supportEmail'));
    expect(StubEmail.lastSent.text).to.contain(link);
    expect(StubEmail.lastSent.html).to.contain(link);
  });

  it('fails silently if the row does not exist', async function () {
    let task = (await getContainer().lookup('send-email-card-drop-verification')) as SendEmailCardDropVerification;
    let nonexistentId = '6a0d969f-84e1-41d3-8472-87fcf6353476';

    await task.perform({ email: 'anyone@test.test', id: nonexistentId }, helpers);

    expect(StubEmail.lastSent).to.equal(null);

    let sentryReport = await waitForSentryReport();

    expect(sentryReport.tags).to.deep.equal({
      event: 'send-email-card-drop-verification',
      alert: 'web-team',
    });
    expect(sentryReport.error?.message).to.equal(`Unable to find card drop request with id ${nonexistentId}`);
  });

  it('fails silently if the verification link is expired', async function () {
    let task = (await getContainer().lookup('send-email-card-drop-verification')) as SendEmailCardDropVerification;

    await task.perform({ email: 'anyone@test.test', id: expiredCardDropRequest.id }, helpers);

    expect(StubEmail.lastSent).to.equal(null);

    let sentryReport = await waitForSentryReport();

    expect(sentryReport.tags).to.deep.equal({
      event: 'send-email-card-drop-verification',
      alert: 'web-team',
    });
    expect(sentryReport.error?.message).to.equal(
      `Request with id ${expiredCardDropRequest.id} expired before sending verification link`
    );
  });

  it('reports emailing errors to Sentry with the correct tag, then rethrows', async function () {
    StubEmail.shouldThrow = true;

    let task = (await getContainer().lookup('send-email-card-drop-verification')) as SendEmailCardDropVerification;

    await expect(task.perform({ email: 'anyone@test.test', id: cardDropRequest.id }, helpers)).to.be.rejectedWith(
      'Intentional error in stub email sending'
    );

    expect(StubEmail.lastSent).to.equal(null);

    let sentryReport = await waitForSentryReport();

    expect(sentryReport.tags).to.deep.equal({
      event: 'send-email-card-drop-verification',
      alert: 'web-team',
    });
  });
});
