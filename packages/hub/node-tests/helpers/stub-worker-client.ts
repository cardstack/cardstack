import { Job, TaskSpec } from 'graphile-worker';
import { registry } from '../helpers/server';
import { Suite } from 'mocha';

let jobIdentifiers: string[] = [];
let jobPayloads: any[] = [];
let jobSpecs: (TaskSpec | undefined)[] = [];

export function setupStubWorkerClient(context: Suite) {
  context.beforeEach(function () {
    registry(this).register('worker-client', StubWorkerClient);
  });

  context.afterEach(function () {
    jobIdentifiers = [];
    jobPayloads = [];
    jobSpecs = [];
  });

  return {
    getJobIdentifiers: function () {
      return jobIdentifiers;
    },

    getJobPayloads: function () {
      return jobPayloads;
    },

    getJobSpecs: function () {
      return jobSpecs;
    },
  };
}

export class StubWorkerClient {
  async addJob(identifier: string, payload?: any, spec?: TaskSpec): Promise<Job> {
    jobIdentifiers.push(identifier);
    jobPayloads.push(payload);
    jobSpecs.push(spec);
    return Promise.resolve({} as Job);
  }
}
