import type { EmailCardDropRequest } from '../../routes/email-card-drop-requests';
import { registry, setupHub } from '../helpers/server';
import { Job, TaskSpec } from 'graphile-worker';
import EmailCardDropRequestsQueries from '../../queries/email-card-drop-requests';

let claimedEoa: EmailCardDropRequest = {
  id: '2850a954-525d-499a-a5c8-3c89192ad40e',
  ownerAddress: '0xclaimedAddress',
  emailHash: 'claimedhash',
  verificationCode: 'claimedverificationcode',
  claimedAt: new Date(),
  requestedAt: new Date(),
  transactionHash: '0xclaimedAddressTxnHash',
};
let unclaimedEoa: EmailCardDropRequest = {
  id: 'b176521d-6009-41ff-8472-147a413da450',
  ownerAddress: '0xnotClaimedAddress',
  emailHash: 'unclaimedhash',
  verificationCode: 'unclaimedverificationcode',
  requestedAt: new Date(),
};

let jobIdentifiers: string[] = [];
let jobPayloads: any[] = [];
class StubWorkerClient {
  async addJob(identifier: string, payload?: any, _spec?: TaskSpec): Promise<Job> {
    jobIdentifiers.push(identifier);
    jobPayloads.push(payload);
    return Promise.resolve({} as Job);
  }
}

let emailCardDropRequestsQueries: EmailCardDropRequestsQueries;

describe('GET /email-card-drop/verify', function () {
  this.beforeEach(async function () {
    registry(this).register('worker-client', StubWorkerClient);
  });

  let { request, getContainer } = setupHub(this);

  this.beforeEach(async function () {
    emailCardDropRequestsQueries = await getContainer().lookup('email-card-drop-requests', { type: 'query' });
    await emailCardDropRequestsQueries.insert(claimedEoa);
    await emailCardDropRequestsQueries.insert(unclaimedEoa);
  });

  this.afterEach(async function () {
    jobIdentifiers = [];
    jobPayloads = [];
  });

  it('accepts a valid verification, marks it claimed, and triggers a job to drop a card', async function () {
    let response = await request().get(
      `/email-card-drop/verify?eoa=${unclaimedEoa.ownerAddress}&verification-code=${unclaimedEoa.verificationCode}&email-hash=${unclaimedEoa.emailHash}`
    );

    expect(response.status).to.equal(200);
    expect(response.text).to.equal('You have verified your card drop request');

    let newlyClaimed = (
      await emailCardDropRequestsQueries!.query({
        id: unclaimedEoa.id,
      })
    )[0];

    expect(newlyClaimed.claimedAt).to.exist;

    expect(jobIdentifiers).to.deep.equal(['drop-card']);
    expect(jobPayloads).to.deep.equal([
      {
        id: unclaimedEoa.id,
      },
    ]);
  });

  it('rejects a verification that has been used', async function () {
    let response = await request().get(
      `/email-card-drop/verify?eoa=${claimedEoa.ownerAddress}&verification-code=${claimedEoa.verificationCode}&email-hash=${claimedEoa.emailHash}`
    );

    expect(response.status).to.equal(400);
    expect(response.text).to.equal('You have already claimed a card drop');

    expect(jobIdentifiers).to.be.empty;
    expect(jobPayloads).to.be.empty;
  });

  it('rejects an unknown verification', async function () {
    let response = await request().get(
      `/email-card-drop/verify?eoa=${claimedEoa.ownerAddress}&verification-code=wha&email-hash=${claimedEoa.emailHash}`
    );

    expect(response.status).to.equal(400);
    expect(response.text).to.equal('Code is invalid');

    expect(jobIdentifiers).to.be.empty;
    expect(jobPayloads).to.be.empty;
  });

  it('rejects an unknown email-hash', async function () {
    let response = await request().get(
      `/email-card-drop/verify?eoa=${unclaimedEoa.ownerAddress}&verification-code=${unclaimedEoa.verificationCode}&email-hash=wha`
    );

    expect(response.status).to.equal(400);
    expect(response.text).to.equal('Email is invalid');

    expect(jobIdentifiers).to.be.empty;
    expect(jobPayloads).to.be.empty;
  });

  it('errors if the eoa query parameter is not provided', async function () {
    let response = await request().get(
      `/email-card-drop/verify?verification-code=${unclaimedEoa.verificationCode}&email-hash=${unclaimedEoa.emailHash}`
    );

    expect(response.status).to.equal(400);
    expect(response.text).to.equal('eoa is required');

    expect(jobIdentifiers).to.be.empty;
    expect(jobPayloads).to.be.empty;
  });

  it('errors if the email-hash query parameter is not provided', async function () {
    let response = await request().get(
      `/email-card-drop/verify?verification-code=${unclaimedEoa.verificationCode}&eoa=${unclaimedEoa.ownerAddress}`
    );

    expect(response.status).to.equal(400);
    expect(response.text).to.equal('email-hash is required');

    expect(jobIdentifiers).to.be.empty;
    expect(jobPayloads).to.be.empty;
  });
});
