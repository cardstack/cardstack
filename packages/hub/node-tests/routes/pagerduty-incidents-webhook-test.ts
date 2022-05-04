import { Job, TaskSpec } from 'graphile-worker';
import { PagerdutyIncident } from '../../services/pagerduty-api';
import { registry, setupHub } from '../helpers/server';

class StubPagerdutyApi {
  async fetchIncident(id: string): Promise<PagerdutyIncident> {
    return {
      id: id,
      html_url: 'https://acme.pagerduty.com/incidents/PGR0VU2',
      title: 'A little bump in the road',
      status: 'triggered',
    };
  }
}

let jobIdentifiers: string[] = [];
let jobPayloads: any[] = [];

class StubWorkerClient {
  async addJob(identifier: string, payload?: any, _spec?: TaskSpec): Promise<Job> {
    jobIdentifiers.push(identifier);
    jobPayloads.push(payload);
    return Promise.resolve({} as Job);
  }
}

const EXAMPLE_INCIDENT_TRIGGERED_REQUEST_BODY = {
  event: {
    id: '5ac64822-4adc-4fda-ade0-410becf0de4f',
    event_type: 'incident.triggered',
    resource_type: 'incident',
    occurred_at: '2020-10-02T18:45:22.169Z',
    agent: {
      html_url: 'https://acme.pagerduty.com/users/PLH1HKV',
      id: 'PLH1HKV',
      self: 'https://api.pagerduty.com/users/PLH1HKV',
      summary: 'Tenex Engineer',
      type: 'user_reference',
    },
    client: {
      name: 'PagerDuty',
    },
    data: {
      id: 'PGR0VU2',
      type: 'incident',
      self: 'https://api.pagerduty.com/incidents/PGR0VU2',
      html_url: 'https://acme.pagerduty.com/incidents/PGR0VU2',
      number: 2,
      status: 'triggered',
      incident_key: 'd3640fbd41094207a1c11e58e46b1662',
      created_at: '2020-04-09T15:16:27Z',
      title: 'A little bump in the road',
      service: {
        html_url: 'https://acme.pagerduty.com/services/PF9KMXH',
        id: 'PF9KMXH',
        self: 'https://api.pagerduty.com/services/PF9KMXH',
        summary: 'API Service',
        type: 'service_reference',
      },
      assignees: [
        {
          html_url: 'https://acme.pagerduty.com/users/PTUXL6G',
          id: 'PTUXL6G',
          self: 'https://api.pagerduty.com/users/PTUXL6G',
          summary: 'User 123',
          type: 'user_reference',
        },
      ],
      escalation_policy: {
        html_url: 'https://acme.pagerduty.com/escalation_policies/PUS0KTE',
        id: 'PUS0KTE',
        self: 'https://api.pagerduty.com/escalation_policies/PUS0KTE',
        summary: 'Default',
        type: 'escalation_policy_reference',
      },
      teams: [
        {
          html_url: 'https://acme.pagerduty.com/teams/PFCVPS0',
          id: 'PFCVPS0',
          self: 'https://api.pagerduty.com/teams/PFCVPS0',
          summary: 'Engineering',
          type: 'team_reference',
        },
      ],
      priority: {
        html_url: 'https://acme.pagerduty.com/account/incident_priorities',
        id: 'PSO75BM',
        self: 'https://api.pagerduty.com/priorities/PSO75BM',
        summary: 'P1',
        type: 'priority_reference',
      },
      urgency: 'high',
      conference_bridge: {
        conference_number: '+1 1234123412,,987654321#',
        conference_url: 'https://example.com',
      },
      resolve_reason: null,
    },
  },
};

describe('POST /callbacks/pagerduty-incidents', async function () {
  this.beforeEach(function () {
    jobIdentifiers = [];
    jobPayloads = [];
    registry(this).register('pagerduty-api', StubPagerdutyApi);
    registry(this).register('worker-client', StubWorkerClient);
  });

  let { request } = setupHub(this);

  it('queues a job to post to discord', async function () {
    await request()
      .post('/callbacks/pagerduty-incidents')
      .set('Accept', 'application/json')
      .set('Content-Type', 'application/json')
      .send(EXAMPLE_INCIDENT_TRIGGERED_REQUEST_BODY)
      .expect(200);

    expect(jobIdentifiers).to.deep.equal(['discord-post']);
    expect(jobPayloads).to.deep.equal([
      {
        channel: 'on-call-internal',
        message: 'incident.triggered: A little bump in the road (https://acme.pagerduty.com/incidents/PGR0VU2)',
      },
    ]);
  });

  it('skips events where the resource_type is not incident', async function () {
    await request()
      .post('/callbacks/pagerduty-incidents')
      .set('Accept', 'application/json')
      .set('Content-Type', 'application/json')
      .send({ event: { event_type: 'incident.acknowledged', resource_type: 'not-incident' } })
      .expect(422);
    expect(jobIdentifiers).to.deep.equal([]);
    expect(jobPayloads).to.deep.equal([]);
  });

  it('skips events where the type is not supported', async function () {
    await request()
      .post('/callbacks/pagerduty-incidents')
      .set('Accept', 'application/json')
      .set('Content-Type', 'application/json')
      .send({ event: { event_type: 'incident.unsupported', resource_type: 'incident' } })
      .expect(422);
    expect(jobIdentifiers).to.deep.equal([]);
    expect(jobPayloads).to.deep.equal([]);
  });
});
