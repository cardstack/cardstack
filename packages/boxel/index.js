'use strict';
/* eslint-disable @typescript-eslint/no-var-requires */
const mergeTrees = require('broccoli-merge-trees');
const stew = require('broccoli-stew');
const path = require('path');

const DEFAULT_OPTIONS = {
  preserveAddonUsageFiles: false,
  processColocatedAppCss: false,
};

module.exports = {
  name: require('./package').name,

  isDevelopingAddon() {
    return true;
  },

  getBoxelOptions() {
    let parent = this.app || this.parent;
    let boxelOptions = parent && parent.options && parent.options.boxel;
    return Object.assign({}, DEFAULT_OPTIONS, boxelOptions);
  },

  treeForAddon(tree) {
    let { preserveAddonUsageFiles } = this.getBoxelOptions();

    if (!preserveAddonUsageFiles) {
      tree = stew.rm(tree, 'components/**/usage.*');
      tree = stew.rm(tree, 'usage-support/**');
    }

    // tree = stew.log(tree, { label: 'treeForAddon', output: 'tree' });
    tree = this._super.treeForAddon.apply(this, [tree]);
    return tree;
  },

  treeForApp() {
    let tree = this._super.treeForApp.apply(this, arguments);
    let trees = [this.automaticReexports()];
    if (tree) {
      trees.push(tree);
    }
    return mergeTrees(trees, {
      overwrite: true,
    });
  },

  treeForAddonStyles() {
    return undefined;
  },

  treeForStyles() {
    // all our styles are directly imported into the components
    return undefined;
  },

  automaticReexports() {
    let { preserveAddonUsageFiles } = this.getBoxelOptions();

    // grab all js files from the addon directory, except utils
    let addonFiles = stew.find(
      this.treeGenerator(path.join(__dirname, 'addon')),
      '**/*.+(js|ts|hbs)'
    );
    addonFiles = stew.rm(addonFiles, 'utils/*.*');
    addonFiles = stew.rm(addonFiles, '**/*.d.ts');
    if (!preserveAddonUsageFiles) {
      addonFiles = stew.rm(addonFiles, 'components/**/usage.*');
    }

    // rewrite them into reexports
    let reexports = stew.map(addonFiles, (_content, relativePath) => {
      let pathWithoutExtension = relativePath
        .replace(/\.(ts|js|hbs)$/, '')
        .replace(/\/index$/, '');
      // console.debug(`[boxel] Exporting ${pathWithoutExtension} to app`);
      return `export { default } from "${this.name}/${pathWithoutExtension}";`;
    });
    reexports = stew.rename(reexports, '.hbs', '.js');
    reexports = stew.rename(reexports, '.ts', '.js');

    return reexports;
  },
};
