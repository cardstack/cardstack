import { setupHub } from '../helpers/server';
import shortUUID from 'short-uuid';

describe('GET /api/job-tickets/:id', function () {
  let { request, getContainer } = setupHub(this);
  let jobTicketsQueries, jobTicketId: string;

  this.beforeEach(async function () {
    jobTicketsQueries = await getContainer().lookup('job-tickets', { type: 'query' });
    jobTicketId = shortUUID.uuid();

    await jobTicketsQueries.insert({ id: jobTicketId, jobType: 'a-job', ownerAddress: '0x000' });
  });

  it('returns the job ticket details', async function () {
    await request()
      .get(`/api/job-tickets/${jobTicketId}`)
      .set('Content-Type', 'application/vnd.api+json')
      .expect(200)
      .expect({
        data: {
          id: jobTicketId,
          type: 'job-tickets',
          attributes: { state: 'pending' },
        },
      })
      .expect('Content-Type', 'application/vnd.api+json');
  });

  it('returns 404 for an unknown job', async function () {
    let randomId = shortUUID.uuid();

    await request()
      .get(`/api/job-tickets/${randomId}`)
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
