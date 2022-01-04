import config from 'config';
import fetch from 'node-fetch';

interface StatuspageComponent {
  id: string;
  name: string;
}

interface StatuspageIncident {
  id: string;
  name: string;
  component_ids: [];
}

let baseUrl = 'https://api.statuspage.io/v1';
let pageId = config.get('statuspage.pageId');
let apiKey = config.get('statuspage.apiKey');

export default class StatuspageApi {
  async createIncident(componentName: string, name: string) {
    let componentId = await this.getComponentId(componentName);
    let unresolvedIncidents = await this.getUnresolvedIncidents();
    let relatedIncident = this.findIncidentByComponentId(unresolvedIncidents, componentId);

    if (relatedIncident) {
      return; // An incident for this component is already open
    }

    return await this.request(`/pages/${pageId}/incidents`, 'POST', {
      incident: {
        name,
        impact: 'minor',
        status: 'investigating',
        components: { [componentId]: 'partial_outage' }, // Will update individual components' status
        component_ids: [componentId], // Will associate incident with the component
      },
    });
  }

  async resolveIncident(componentName: string) {
    let componentId = await this.getComponentId(componentName);
    let unresolvedIncidents = await this.getUnresolvedIncidents();
    let relatedIncident = this.findIncidentByComponentId(unresolvedIncidents, componentId);

    if (relatedIncident) {
      await this.request(`/pages/${pageId}/incidents/${relatedIncident.id}`, 'PATCH', {
        incident: {
          components: { [componentId]: 'operational' },
          status: 'resolved',
        },
      });
    }
  }

  private async getUnresolvedIncidents(): Promise<StatuspageIncident[]> {
    let incidents = await this.request(`/pages/${pageId}/incidents/unresolved`);

    return incidents.map((incident: any) => {
      return {
        id: incident.id,
        component_ids: incident.components.map((component: any) => component.id),
      };
    });
  }

  private async getComponentId(componentName: string) {
    let component = (await this.getComponents()).find((component) => {
      return component.name === componentName;
    });

    if (!component) {
      throw new Error(`Statuspage component ${componentName} not found`);
    } else {
      return component.id;
    }
  }

  private async getComponents(): Promise<StatuspageComponent[]> {
    let components = await this.request(`/pages/${pageId}/components`);

    return components.map((component: StatuspageComponent) => {
      return {
        id: component.id,
        name: component.name,
      };
    });
  }

  private findIncidentByComponentId(incidents: StatuspageIncident[], componentId: string) {
    return incidents.find((incident) => {
      // Checks for array equality
      return JSON.stringify(incident.component_ids) === JSON.stringify([componentId]);
    });
  }

  private async request(path: string, method: 'GET' | 'POST' | 'PATCH' = 'GET', payload: any = null) {
    let params = {
      method,
      headers: {
        Authorization: `OAuth: ${apiKey}`,
        'Content-Type': 'application/json',
      },
    };

    if (payload) {
      (params as any).body = JSON.stringify(payload);
    }

    let result = await fetch(`${baseUrl}${path}`, params);
    let jsonResponse = await result.json();

    if (jsonResponse.error) {
      throw new Error(`Statuspage client error: ${jsonResponse.error}`);
    }

    return jsonResponse;
  }
}

declare module '@cardstack/di' {
  interface KnownServices {
    'statuspage-api': StatuspageApi;
  }
}
