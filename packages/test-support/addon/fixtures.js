import Factory from './jsonapi-factory';
import { hubURL } from '@cardstack/hub/environment';

export default class Fixtures {
  constructor(fn) {
    this.factory = new Factory();
    this._id = null;
    fn(this.factory);
  }
  async setup() {
    if (this._id == null) {
      await this._restoreCheckpoint('empty');
      for (let model of inDependencyOrder(this.factory.getModels())) {
        let response = await fetch(`${hubURL}/api/${model.type}`, {
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
    }
    // this restores even on the first pass because it's a way to block until indexing happens
    await this._restoreCheckpoint(this._id);
  }

  async _createCheckpoint() {
    let response = await fetch(`${hubURL}/api/ephemeral-checkpoints`, {
      method: 'POST',
      body: JSON.stringify({
        data: { type: 'ephemeral-checkpoints' }
      })
    });
    if (response.status !== 201) {
      throw new Error(`Unexpected response ${response.status} while trying to create checkpoint: ${await response.text()}`);
    }
    return (await response.json()).data.id;
  }

  async _restoreCheckpoint(id) {
    let response = await fetch(`${hubURL}/api/ephemeral-restores`, {
      method: 'POST',
      body: JSON.stringify({
        data: {
          type: 'ephemeral-restores',
          relationships: {
            checkpoint: {
              data: { type: 'ephemeral-checkpoints', id }
            }
          }
        }
      })
    });
    if (response.status !== 201) {
      throw new Error(`Unexpected response ${response.status} while trying to restore cehckpoint: ${await response.text()}`);
    }
  }
}

// FIXME: this requires more understanding of the schema than is
// appropriate in this module. Also, this is duplicated in
// test-support/env
function inDependencyOrder(models) {
  let priority = ['default-values', 'plugin-configs', 'constraints', 'fields', 'data-sources', 'content-types'];
  return priority.map(type => models.filter(m => m.type === type)).reduce((a,b) => a.concat(b), []).concat(models.filter(m => !priority.includes(m.type)));
}
