import { registry, setupHub } from '../helpers/server';
import shortUUID from 'short-uuid';

class StubAuthenticationUtils {
  validateAuthToken(encryptedAuthToken: string) {
    return handleValidateAuthToken(encryptedAuthToken);
  }
}

let stubUserAddress = '0x2f58630CA445Ab1a6DE2Bb9892AA2e1d60876C13';
function handleValidateAuthToken(encryptedString: string) {
  expect(encryptedString).to.equal('abc123--def456--ghi789');
  return stubUserAddress;
}

describe('GET /api/job-tickets/:id', function () {
  this.beforeEach(function () {
    registry(this).register('authentication-utils', StubAuthenticationUtils);
  });

  let { request, getContainer } = setupHub(this);
  let jobTicketsQueries, jobTicketId: string, otherOwnerJobTicketId: string;

  this.beforeEach(async function () {
    jobTicketsQueries = await getContainer().lookup('job-tickets', { type: 'query' });

    jobTicketId = shortUUID.uuid();
    await jobTicketsQueries.insert({ id: jobTicketId, jobType: 'a-job', ownerAddress: stubUserAddress });
    await jobTicketsQueries.update(jobTicketId, { 'a-result': 'yes' }, 'success');

    otherOwnerJobTicketId = shortUUID.uuid();
    await jobTicketsQueries.insert({ id: otherOwnerJobTicketId, jobType: 'a-job', ownerAddress: '0x111' });
  });

  it('returns the job ticket details', async function () {
    await request()
      .get(`/api/job-tickets/${jobTicketId}`)
      .set('Authorization', 'Bearer abc123--def456--ghi789')
      .set('Content-Type', 'application/vnd.api+json')
      .expect(200)
      .expect({
        data: {
          id: jobTicketId,
          type: 'job-tickets',
          attributes: { state: 'success', result: { 'a-result': 'yes' } },
        },
      })
      .expect('Content-Type', 'application/vnd.api+json');
  });

  it('returns 401 without bearer token', async function () {
    await request()
      .get(`/api/job-tickets/${jobTicketId}`)
      .set('Content-Type', 'application/vnd.api+json')
      .expect(401)
      .expect({
        errors: [
          {
            status: '401',
            title: 'No valid auth token',
          },
        ],
      })
      .expect('Content-Type', 'application/vnd.api+json');
  });

  it('returns 401 when the job ticket requested is for a different owner', async function () {
    await request()
      .get(`/api/job-tickets/${otherOwnerJobTicketId}`)
      .set('Authorization', 'Bearer abc123--def456--ghi789')
      .set('Content-Type', 'application/vnd.api+json')
      .expect(401)
      .expect({
        errors: [
          {
            status: '401',
            title: 'No valid auth token',
          },
        ],
      })
      .expect('Content-Type', 'application/vnd.api+json');
  });

  it('returns 404 for an unknown job', async function () {
    let randomId = shortUUID.uuid();

    await request()
      .get(`/api/job-tickets/${randomId}`)
      .set('Authorization', 'Bearer abc123--def456--ghi789')
      .set('Content-Type', 'application/vnd.api+json')
      .expect(404)
      .expect({
        errors: [
          {
            status: '404',
            title: 'Job ticket not found',
            detail: `Could not find the job ticket ${randomId}`,
          },
        ],
      })
      .expect('Content-Type', 'application/vnd.api+json');
  });
});
