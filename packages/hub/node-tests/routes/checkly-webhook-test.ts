import { registry, setupHub } from '../helpers/server';

let createdIncident: { componentName: string; message: string } | null,
  resolvedIncident: { componentName: string } | null;

class StubStatuspageApi {
  async createIncident(componentName: string, message: string): Promise<void> {
    createdIncident = {
      componentName,
      message,
    };
  }
  async resolveIncident(componentName: string): Promise<void> {
    resolvedIncident = {
      componentName,
    };
  }
}

describe('POST /api/checkly-webhook', async function () {
  this.beforeEach(function () {
    createdIncident = null;
    resolvedIncident = null;

    registry(this).register('statuspage-api', StubStatuspageApi);
  });

  let { request } = setupHub(this);

  it('creates a new alert when the check failed', async function () {
    await request()
      .post('/callbacks/checkly')
      .set('Accept', 'application/json')
      .set('Content-Type', 'application/json')
      .send({
        check_name: 'hub-prod subgraph / RPC node block number diff within threshold',
        alert_type: 'ALERT_FAILURE',
      })
      .expect(200);

    expect(createdIncident).to.deep.equal({
      componentName: 'Subgraph',
      message:
        'We are experiencing blockchain indexing delays. The blockchain index is delayed by at least 10 blocks. This will result increased transaction processing times.',
    });
  });

  it('creates a new alert when the check recovered', async function () {
    await request()
      .post('/callbacks/checkly')
      .set('Accept', 'application/json')
      .set('Content-Type', 'application/json')
      .send({
        check_name: 'hub-prod subgraph / RPC node block number diff within threshold',
        alert_type: 'ALERT_RECOVERY',
      })
      .expect(200);

    expect(createdIncident).to.be.null;
    expect(resolvedIncident).to.deep.equal({
      componentName: 'Subgraph',
    });
  });

  it('returns 422 when processing an unrecognized check', async function () {
    await request()
      .post('/callbacks/checkly')
      .set('Accept', 'application/json')
      .set('Content-Type', 'application/json')
      .send({
        check_name: 'abc123',
        alert_type: 'ALERT_FAILURE',
      })
      .expect(422);
  });
});
