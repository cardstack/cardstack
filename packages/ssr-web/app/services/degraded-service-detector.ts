import Service from '@ember/service';
import config from '../config/environment';
import { taskFor } from 'ember-concurrency-ts';
import { task, TaskGenerator, timeout } from 'ember-concurrency';
import { tracked } from '@glimmer/tracking';
import * as Sentry from '@sentry/browser';

export default class DegradedServiceDetector extends Service {
  @tracked notificationShown: boolean = false;
  @tracked notificationBody: string | null = null;
  @tracked impact: 'none' | 'minor' | 'major' | 'critical' | null = null;

  statusPageUrl = config.urls.statusPageUrl;

  constructor() {
    super(...arguments);
    taskFor(this.pollForStatusTask).perform();
  }

  get isSevere() {
    return this.impact === 'major' || this.impact === 'critical';
  }

  @task *pollForStatusTask(): TaskGenerator<void> {
    while (true) {
      let statusData = yield this.getDegradationStatusData();

      if (statusData) {
        this.notificationShown = true;
        this.impact = statusData.impact;
        this.notificationBody = statusData.name;
      } else {
        this.notificationShown = false;
        this.notificationBody = null;
        this.impact = null;
      }

      if (config.environment === 'test') {
        return;
      }

      yield timeout(1000 * 60);
    }
  }

  async getDegradationStatusData(): Promise<Incident | null> {
    let data = {} as StatuspageStatusAPISummaryResponse;

    try {
      let response = await fetch(this.statusPageUrl);
      data = await response.json();
    } catch (e) {
      console.error('Failed to fetch Statuspage summary', e);
      Sentry.captureException(e);

      return null;
    }

    let order = ['none', 'minor', 'major', 'critical'];

    let incidentsAndMaintenances = (data.incidents || []).concat(
      data.scheduled_maintenances || []
    );

    if (incidentsAndMaintenances.length === 0) {
      return null;
    }

    let highestImpact = incidentsAndMaintenances.sort((a: any, b: any) => {
      if (order.indexOf(a.impact) > order.indexOf(b.impact)) {
        return -1;
      }
      if (order.indexOf(a.impact) < order.indexOf(b.impact)) {
        return 1;
      }

      return 0;
    })[0].impact;

    let incident = incidentsAndMaintenances
      .filterBy('impact', highestImpact)
      .sort((a: any, b: any) => {
        return +new Date(b.started_at) - +new Date(a.started_at);
      })[0];

    let lastUpdate =
      incident.incident_updates[incident.incident_updates.length - 1];

    return {
      status: incident.status,
      name: `${incident.name}: ${this.addPunctuation(lastUpdate.body)}`,
      impact: incident.impact,
    };
  }

  addPunctuation(text: string) {
    if (text.endsWith('.')) {
      return text;
    }

    return `${text}.`;
  }
}

// https://metastatuspage.com/api#incidents-unresolved
type StatuspageStatusAPISummaryResponse = {
  incidents: Array<StatuspageIncidentOrMaintenance>;
  scheduled_maintenances: Array<StatuspageIncidentOrMaintenance>;
};

type StatuspageIncidentOrMaintenance = {
  impact: string;
  incident_updates: [
    {
      body: string;
    }
  ];
  name: string;
  status: string;
};

type Incident = {
  name: string;
  impact: string;
  status: string;
};
