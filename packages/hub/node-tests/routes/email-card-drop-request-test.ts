import type { EmailCardDropRequest } from '../../routes/email-card-drop-requests';
import { setupHub } from '../helpers/server';

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

describe('GET /api/email-card-drop-requests', function () {
  let { request, getContainer } = setupHub(this);

  this.beforeEach(async function () {
    let emailCardDropRequestsQueries = await getContainer().lookup('email-card-drop-requests', { type: 'query' });
    await emailCardDropRequestsQueries.insert(claimedEoa);
    await emailCardDropRequestsQueries.insert(unclaimedEoa);
  });

  it('returns true if a known EOA has a transaction hash recorded for its card drop request', async function () {
    let response = await request()
      .get(`/api/email-card-drop-requests?eoa=${claimedEoa.ownerAddress}`)
      .set('Accept', 'application/vnd.api+json')
      .set('Content-Type', 'application/vnd.api+json');
    expect(response.status).to.equal(200);
    expect(response.body.data.type).to.equal('email-card-drop-request-claim-status');
    expect(response.body.data.attributes['owner-address']).to.equal(claimedEoa.ownerAddress);
    expect(response.body.data.attributes.claimed).to.equal(true);
    expect(response.body.data.attributes.timestamp).to.not.be.undefined;
  });

  it('returns false if a known EOA does not have a transaction hash recorded for its card drop request', async function () {
    let response = await request()
      .get(`/api/email-card-drop-requests?eoa=${unclaimedEoa.ownerAddress}`)
      .set('Accept', 'application/vnd.api+json')
      .set('Content-Type', 'application/vnd.api+json');
    expect(response.status).to.equal(200);
    expect(response.body.data.type).to.equal('email-card-drop-request-claim-status');
    expect(response.body.data.attributes['owner-address']).to.equal(unclaimedEoa.ownerAddress);
    expect(response.body.data.attributes.claimed).to.equal(false);
    expect(response.body.data.attributes.timestamp).to.not.be.undefined;
  });

  it('returns false if the EOA is not in the db', async function () {
    let response = await request()
      .get(`/api/email-card-drop-requests?eoa=notrecorded`)
      .set('Accept', 'application/vnd.api+json')
      .set('Content-Type', 'application/vnd.api+json');

    expect(response.status).to.equal(200);
    expect(response.body.data.type).to.equal('email-card-drop-request-claim-status');
    expect(response.body.data.attributes['owner-address']).to.equal('notrecorded');
    expect(response.body.data.attributes.claimed).to.equal(false);
    expect(response.body.data.attributes.timestamp).to.not.be.undefined;
  });
});
