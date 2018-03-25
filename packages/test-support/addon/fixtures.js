import Factory from './jsonapi-factory';
import { hubURL } from '@cardstack/plugin-utils/environment';

export default class Fixtures {
  constructor(dataSourceId, fn) {
    this.dataSourceId = dataSourceId;
    this.factory = new Factory();
    this._id = null;
    fn(this.factory);
  }
  async setup() {
    if (this._id == null) {
      await this._restoreCheckpoint('empty');
      let models = this.factory.getModels();
      for (let [index, model] of models.entries()) {
        let url = `${hubURL}/api/${model.type}`;
        if (index < models.length - 1) {
          // On all but the last api request, we opt in to not waiting
          // for the content to be indexed. This lets us move faster
          // and then wait for indexing to happen once at the end.
          url += '?nowait';
        }
        let response = await fetch(url, {
          method: 'POST',
          body: JSON.stringify({
            data: {
              id: model.id,
              type: model.type,
              attributes: model.attributes,
              relationships: model.relationships
            }
          })
        });
        if (response.status !== 201) {
          throw new Error(`Unexpected response ${response.status} while trying to define fixtures: ${await response.text()}`);
        }
      }
      this._id = await this._createCheckpoint();
    } else {
      await this._restoreCheckpoint(this._id);
    }
  }

  async _createCheckpoint() {
    let response = await fetch(`${hubURL}/api/checkpoints`, {
      method: 'POST',
      body: JSON.stringify({
        data: {
          type: 'checkpoints',
          relationships: {
            'checkpoint-data-source': { data: { type: 'data-sources', id: this.dataSourceId } }
          }
        }
      })
    });
    if (response.status !== 201) {
      throw new Error(`Unexpected response ${response.status} while trying to create checkpoint: ${await response.text()}`);
    }
    return (await response.json()).data.id;
  }

  async _restoreCheckpoint(id) {
    let response = await fetch(`${hubURL}/api/restores`, {
      method: 'POST',
      body: JSON.stringify({
        data: {
          type: 'restores',
          relationships: {
            checkpoint: { data: { type: 'checkpoints', id } },
            'checkpoint-data-source': { data: { type: 'data-sources', id: this.dataSourceId } }
          }
        }
      })
    });
    if (response.status !== 201) {
      throw new Error(`Unexpected response ${response.status} while trying to restore checkpoint: ${await response.text()}`);
    }
  }
}
