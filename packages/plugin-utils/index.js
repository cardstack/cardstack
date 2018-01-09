const locateHub = require('./locate-hub');
const ConditionalInclude = require('./conditional-include');

module.exports = {
  name: '@cardstack/plugin-utils',

  treeForAddon() {
    let tree = this._super.apply(this, arguments);
    async function hubNotRunning() {
      let hub = await locateHub();
      if (!hub) {
        return true;
      }
      return !(await hub.url());
    }
    return new ConditionalInclude(tree, { name: 'default cardstack env', predicate: hubNotRunning });
  }

};
