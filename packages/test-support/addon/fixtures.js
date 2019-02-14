import Factory from './jsonapi-factory';
import { hubURL } from '@cardstack/plugin-utils/environment';
import { ciSessionId } from '@cardstack/test-support/environment';

export default class Fixtures {
  constructor({ create, destroy }) {
    this._factory = null;
    this._create = create;
    this._destroy = destroy;
  }

  setupTest(hooks) {
    hooks.beforeEach(async () => await this.setup());
    hooks.afterEach(async () => await this.teardown());
  }

  async setup() {
    if (typeof this._create !== 'function') { return; }

    if (!this._factory) {
      this._factory = new Factory();
      await this._create(this._factory);
    }

    let models = this._factory.getModels();

    for (let [, model] of models.entries()) {
      let response = await this._createModel(model);
      if (response.status === 409) {
        await this._fetchAndDelete(model);
        response = await this._createModel(model);
      }
      if (response.status !== 201) {
        throw new Error(`Unexpected response ${response.status} while trying to define fixtures: ${await response.text()}`);
      }
    }
  }

  async _createModel(model) {
    let url = `${hubURL}/api/${encodeURIComponent(model.type)}`;
    return await fetch(url, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${ciSessionId}`,
        "content-type": 'application/vnd.api+json'
      },
      body: JSON.stringify({
        data: {
          id: model.id,
          type: model.type,
          attributes: model.attributes,
          relationships: model.relationships
        }
      })
    });
  }

  async teardown() {
    let destructionList = [];
    if (typeof this._destroy === 'function') {
      destructionList = destructionList.concat(this._destroy());
    }

    if (this._factory) {
      let createdModels = this._factory.getModels().map(model => {
        return { id: model.id, type: model.type };
      });
      destructionList = destructionList.concat(createdModels.reverse());
    }

    for (let item of destructionList) {
      if (!item.type) { continue; }

      if (item.id) {
        await this._fetchAndDelete(item);
      } else {
        let response = await fetch(`${hubURL}/api/${encodeURIComponent(item.type)}`, {
          method: 'GET',
          headers: {
            authorization: `Bearer ${ciSessionId}`,
            accept: 'application/vnd.api+json'
          }
        });

        if (response.status !== 200) { continue; }

        let { data:models } = await response.json();
        for (let model of models) {
          await this._deleteModel(model);
        }
      }
    }
  }

  async _fetchAndDelete(item) {
    let response = await fetch(`${hubURL}/api/${encodeURIComponent(item.type)}/${encodeURIComponent(item.id)}`, {
      method: 'GET',
      headers: {
        authorization: `Bearer ${ciSessionId}`,
        accept: 'application/vnd.api+json'
      }
    });

    if (response.status === 200) {
      let { data:model } = await response.json();
      await this._deleteModel(model);
    }
  }

  async _deleteModel(model) {
    if (model.type === 'user-realms') { return; }

    let version = model.meta && model.meta.version;
    let headers = {
      authorization: `Bearer ${ciSessionId}`,
      'content-type': 'application/vnd.api+json'
    };
    if (version) {
      headers["If-Match"] = version;
    }
    let url = `${hubURL}/api/${encodeURIComponent(model.type)}/${encodeURIComponent(model.id)}`;
    await fetch(url, {
      method: 'DELETE',
      headers
    });
  }
}
