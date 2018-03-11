/*
  This is a particularly high-level bit of configuration. Since it
  determines which data sources are even in play, it cannot be stored
  in any data source. It must come directly from a seed model.
*/

const { declareInjections } = require('@cardstack/di');

module.exports = declareInjections({
  dataSources: 'config:data-sources'
},

class ControllingBranch {
  constructor() {
    this._name = null;
  }
  get name() {
    if (!this._name) {
      let config = this.dataSources.find(m => m.type === 'plugin-configs' && m.id === '@cardstack/hub');
      if (config && config.attributes && config.attributes['controlling-branch']) {
        this._name = config.attributes['controlling-branch'];
      } else {
        this._name = 'master';
      }
    }
    return this._name;
  }
});
