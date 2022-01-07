import { registry, setupHub } from '../helpers/server';

class StubStatuspageApi {
  async createIncident(_componentName: string, _name: string) {
    return true;
  }
  async resolveIncident(_componentName: string) {
    return true;
  }
}

describe('POST /api/checkly-webhook', async function () {
  this.beforeEach(function () {
    registry(this).register('statuspage-api', StubStatuspageApi);
  });

  let { request } = setupHub(this);

  it('returns 200 when processing a check', async function () {
    await request()
      .post('/callbacks/checkly')
      .set('Accept', 'application/json')
      .set('Content-Type', 'application/json')
      .send({
        check_name: 'hub-prod subgraph / RPC node block number diff within threshold',
        alert_type: 'ALERT_FAILURE',
      })
      .expect(200);
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
