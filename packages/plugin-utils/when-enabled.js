/*
  Wrapper for enabling/disabling ember addon build output based on
  whether the addon is enabled in cardstack hub.
*/
const ConditionalInclude = require('./conditional-include');
const locateHub = require('@cardstack/plugin-utils/locate-hub');
const request = require('superagent');

const treeMethods = [
  'treeForAddon',
  'treeForAddonTemplates',
  'treeForAddonTestSupport',
  'treeForApp',
  'treeForPublic',
  'treeForStyles',
  'treeForTemplates',
  'treeForTestSupport',
  'treeForVendor'
];

module.exports = function whenEnabled(plugin) {
  async function enabled() {
    let baseURL;
    {
      let hub = await locateHub();
      if (hub) {
        baseURL = await hub.url();
      }
    }
    if (!baseURL) {
      // no hub is configured. so there can't be any config in that
      // hub disabling any plugins, so we default to enabled.
      return true;
    }
    let url = `${baseURL}/api/plugins/${encodeURIComponent(plugin.name)}`;
    let response;
    try {
      response = await request.get(url);
    } catch (err) {
      throw new Error(`Unable to check whether plugin ${plugin.name} is enabled: got exception ${err.message} from ${url}`);
    }
    if (response.status !== 200) {
      throw new Error(`Unable to check whether plugin ${plugin.name} is enabled: got status ${response.status} from ${url}`);
    }
    return response.body.data.attributes.enabled;
  }

  function gate(methodName) {
    return function(tree) {
      let func = plugin[methodName] || this._super;
      let upstreamTree = func.call(this, tree);
      if (upstreamTree) {
        return new ConditionalInclude(upstreamTree, { predicate: enabled, name: plugin.name });
      }
    };
  }

  let overrides = {};
  for (let method of treeMethods) {
    overrides[method] = gate(method);
  }
  return Object.assign({}, plugin, overrides);
};
