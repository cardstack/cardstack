interface HubConfigResponse {
  web3: Web3HubConfig;
}
interface Web3HubConfig {
  layer1Network: string;
  layer1RpcNodeHttpsUrl: string;
  layer1RpcNodeWssUrl: string;
  layer2Network: string;
  layer2RpcNodeHttpsUrl: string;
  layer2RpcNodeWssUrl: string;
}

export default class HubConfig {
  constructor(private hubRootUrl: string) {}
  #cachedConfigResponse: HubConfigResponse | null = null;

  async getConfig(): Promise<HubConfigResponse> {
    if (!this.#cachedConfigResponse) {
      let response = await this.httpGetConfig();
      if (response.ok) {
        let responseJson = await response.json();
        this.#cachedConfigResponse = responseJson.data.attributes as HubConfigResponse;
      } else {
        let responseJson = await response.json();
        console.error('Failed.', responseJson);
        throw new Error('Failed to get config.' + JSON.stringify(responseJson));
      }
    }
    return this.#cachedConfigResponse;
  }

  private async httpGetConfig(): Promise<Response> {
    let url = `${this.hubRootUrl}/api/config`;
    let headers = {
      'Content-Type': 'application/vnd.api+json',
    } as Record<string, string>;
    return global.fetch(url, { headers });
  }
}
