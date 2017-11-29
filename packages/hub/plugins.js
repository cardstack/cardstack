const { declareInjections } = require('@cardstack/di');


module.exports = declareInjections({
  controllingBranch: 'hub:controlling-branch',
  currentSchema: 'hub:current-schema'
},

class Plugins {
  async active() {
    let schema = await this.currentSchema.forBranch(this.controllingBranch.name);
    return schema.plugins;
  }
});
