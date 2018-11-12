import Factory from './jsonapi-factory';
import { hubURL } from '@cardstack/plugin-utils/environment';
import { ciSessionId } from '@cardstack/test-support/environment';

export default class Fixtures {
  constructor({ create, destroy }) {
    this._factory = new Factory();
    this._create = create;
    this._destroy = destroy;
  }

  setupTest(hooks) {
    hooks.beforeEach(async () => {
      await this.teardown();
      await this.setup();
    });
    hooks.afterEach(async () => await this.teardown());
  }

  async setup() {
    if (typeof this._create !== 'function') {
      return;
    }

    await this._create(this._factory);

    let models = this._factory.getModels();

    for (let [, model] of models.entries()) {
      let url = `${hubURL}/api/${encodeURIComponent(model.type)}`;
      let response = await fetch(url, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${ciSessionId}`,
          'content-type': 'application/vnd.api+json',
        },
        body: JSON.stringify({
          data: {
            id: model.id,
            type: model.type,
            attributes: model.attributes,
            relationships: model.relationships,
          },
        }),
      });
      if (response.status !== 201) {
        throw new Error(
          `Unexpected response ${response.status} while trying to define fixtures: ${await response.text()}`,
        );
      }
    }
  }

  async teardown() {
    if (typeof this._create !== 'function') {
      return;
    }

    let destructionList = [];
    if (typeof this._destroy === 'function') {
      destructionList = destructionList.concat(this._destroy());
    }

    let createdModels = this._factory.getModels().map(model => {
      return { id: model.id, type: model.type };
    });
    destructionList = destructionList.concat(createdModels.reverse());

    for (let [index, item] of destructionList.entries()) {
      if (!item.type) {
        continue;
      }

      let isLast = index === destructionList.length - 1;

      if (item.id) {
        let response = await fetch(`${hubURL}/api/${encodeURIComponent(item.type)}/${encodeURIComponent(item.id)}`, {
          method: 'GET',
          headers: {
            authorization: `Bearer ${ciSessionId}`,
            accept: 'application/vnd.api+json',
          },
        });

        if (response.status !== 200) {
          continue;
        }

        let { data: model } = await response.json();
        await this._deleteModel(model, isLast);
      } else {
        let response = await fetch(`${hubURL}/api/${encodeURIComponent(item.type)}`, {
          method: 'GET',
          headers: {
            authorization: `Bearer ${ciSessionId}`,
            accept: 'application/vnd.api+json',
          },
        });

        if (response.status !== 200) {
          continue;
        }

        let { data: models } = await response.json();
        for (let model of models) {
          await this._deleteModel(model, isLast);
        }
      }
    }
  }

  async _deleteModel(model) {
    if (model.type === 'user-realms') {
      return;
    }

    let version = model.meta && model.meta.version;
    let headers = {
      authorization: `Bearer ${ciSessionId}`,
      'content-type': 'application/vnd.api+json',
    };
    if (version) {
      headers['If-Match'] = version;
    }
    let url = `${hubURL}/api/${encodeURIComponent(model.type)}/${encodeURIComponent(model.id)}`;
    await fetch(url, {
      method: 'DELETE',
      headers,
    });
  }
}
