import Service from '@ember/service';
import { tracked } from '@glimmer/tracking';
import { task, TaskGenerator, timeout } from 'ember-concurrency';
import * as Sentry from '@sentry/browser';
import { taskFor } from 'ember-concurrency-ts';

interface DegradationFileData {
  status?: string;
  notificationTitle?: string;
  notificationBody?: string;
}

export default class DegradationDetector extends Service {
  @tracked notificationShown: boolean = false;
  @tracked status: 'degraded' | 'operational' = 'operational';
  @tracked notificationTitle: string | null = null;
  @tracked notificationBody: string | null = null;

  constructor() {
    super(...arguments);

    taskFor(this.pollForStatusTask).perform();
  }

  @task *pollForStatusTask(): TaskGenerator<void> {
    while (true) {
      let statusData = yield this.getDegradationStatusData();

      if (statusData.status === 'degraded') {
        this.status = 'degraded';
        this.notificationTitle = statusData.notificationTitle;
        this.notificationBody = statusData.notificationBody;

        console.log(`${this.notificationTitle}\n\n${this.notificationBody}`);
      } else {
        // TODO: show potential warnings from https://github.com/cardstack/cardstack/pull/2484

        this.status = 'operational';
        this.notificationTitle = null;
        this.notificationBody = null;
      }

      yield timeout(1000 * 60);
    }
  }

  async getDegradationStatusData(): Promise<DegradationFileData> {
    let fileUrl =
      'https://cardstack-status.s3.amazonaws.com/cardstack-status.json';

    try {
      let response = await fetch(fileUrl);
      let data = await response.json();

      return {
        status: data.status,
        notificationTitle: data.title,
        notificationBody: data.body,
      };
    } catch (_) {
      Sentry.captureException(`Unable to fetch status file from ${fileUrl}`);
      return {};
    }
  }
}

declare module '@ember/service' {
  interface Registry {
    'degradation-detector': DegradationDetector;
  }
}
