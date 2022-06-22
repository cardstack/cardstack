import { registry, setupHub } from '../helpers/server';
import shortUUID from 'short-uuid';
import JobTicketsQueries from '../../queries/job-tickets';

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

describe('POST /api/job-tickets/:id/retry', function () {
  this.beforeEach(function () {
    registry(this).register('authentication-utils', StubAuthenticationUtils);
  });

  let { request, getContainer } = setupHub(this);
  let jobTicketsQueries: JobTicketsQueries,
    jobTicketId: string,
    otherOwnerJobTicketId: string,
    notFailedJobTicketId: string;
  let ticketIds: string[];

  this.beforeEach(async function () {
    jobTicketsQueries = await getContainer().lookup('job-tickets', { type: 'query' });

    jobTicketId = shortUUID.uuid();
    await jobTicketsQueries.insert({
      id: jobTicketId,
      jobType: 'a-job',
      ownerAddress: stubUserAddress,
      payload: { 'a-payload': 'yes' },
    });
    await jobTicketsQueries.update(jobTicketId, { 'a-result': 'yes' }, 'failed');

    otherOwnerJobTicketId = shortUUID.uuid();
    await jobTicketsQueries.insert({ id: otherOwnerJobTicketId, jobType: 'a-job', ownerAddress: '0x111' });

    notFailedJobTicketId = shortUUID.uuid();
    await jobTicketsQueries.insert({ id: notFailedJobTicketId, jobType: 'a-job', ownerAddress: stubUserAddress });

    ticketIds = [jobTicketId, otherOwnerJobTicketId, notFailedJobTicketId];
  });

  it('adds a new job, adds a job ticket for it, and returns its details', async function () {
    await request()
      .post(`/api/job-tickets/${jobTicketId}/retry`)
      .set('Authorization', 'Bearer abc123--def456--ghi789')
      .set('Content-Type', 'application/vnd.api+json')
      .expect(201)
      .expect(function (res) {
        expect(res.body.data.id).to.not.equal(jobTicketId);
        expect(res.body.data.attributes).to.deep.equal({
          'job-type': 'a-job',
          state: 'pending',
        });
      })
      .expect('Content-Type', 'application/vnd.api+json');

    let allTickets = await jobTicketsQueries.findAll();

    let newTicket = allTickets.find((ticket) => !ticketIds.includes(ticket.id));

    expect(newTicket?.ownerAddress).to.equal(stubUserAddress);
    expect(newTicket?.jobType).to.equal('a-job');
    expect(newTicket?.payload).to.deep.equal({ 'a-payload': 'yes' });
  });

  it('returns 401 without bearer token', async function () {
    await request()
      .post(`/api/job-tickets/${jobTicketId}/retry`)
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
      .post(`/api/job-tickets/${otherOwnerJobTicketId}/retry`)
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

  it('returns 422 when the job ticket state is not failed', async function () {
    await request()
      .post(`/api/job-tickets/${notFailedJobTicketId}/retry`)
      .set('Authorization', 'Bearer abc123--def456--ghi789')
      .set('Content-Type', 'application/vnd.api+json')
      .expect(422)
      .expect({
        errors: [
          {
            status: '422',
            title: 'Job ticket state is not failed',
          },
        ],
      })
      .expect('Content-Type', 'application/vnd.api+json');
  });

  it('returns 404 for an unknown job', async function () {
    let randomId = shortUUID.uuid();

    await request()
      .post(`/api/job-tickets/${randomId}/retry`)
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
