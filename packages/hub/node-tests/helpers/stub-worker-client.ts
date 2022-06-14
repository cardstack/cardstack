import { Job, TaskSpec } from 'graphile-worker';
import { registry } from '../helpers/server';
import { Suite } from 'mocha';

let jobIdentifiers: string[] = [];
let jobPayloads: any[] = [];

export function setupStubWorkerClient(context: Suite) {
  context.beforeEach(function () {
    registry(this).register('worker-client', StubWorkerClient);
  });
}

export function getJobIdentifiers() {
  return jobIdentifiers;
}

export function getJobPayloads() {
  return jobPayloads;
}

export class StubWorkerClient {
  constructor() {
    jobIdentifiers = [];
    jobPayloads = [];
  }

  async addJob(identifier: string, payload?: any, _spec?: TaskSpec): Promise<Job> {
    jobIdentifiers.push(identifier);
    jobPayloads.push(payload);
    return Promise.resolve({} as Job);
  }
}
