import config from 'config';
import { api as createPageDutyApiClient } from '@pagerduty/pdjs';
import { APIResponse } from '@pagerduty/pdjs/build/src/api';

export interface PagerdutyIncident {
  id: string;
  html_url: string;
  title: string;
  status: string;
}

export default class PagerdutyApi {
  private get token(): string | null {
    return config.has('pagerduty.token') ? config.get('pagerduty.token') : null;
  }

  private get apiClient() {
    let { token } = this;
    if (!token) {
      throw new Error('Pagerduty token not configured');
    }
    return createPageDutyApiClient({ token });
  }

  async fetchIncident(incidentId: string): Promise<PagerdutyIncident> {
    let apiResponse: APIResponse = await this.apiClient.get(`/incidents/${incidentId}`);
    return apiResponse.resource as PagerdutyIncident;
  }
}

declare module '@cardstack/di' {
  interface KnownServices {
    'pagerduty-api': PagerdutyApi;
  }
}
