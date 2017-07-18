const fs = require('fs');
const { partition }  = require('lodash');

module.exports = {
  name: 'hub:build',
  description: `Assemble the @cardstack/hub server from your app's plugins`,
  works: 'insideProject',

  anonymousOptions: [],
  availableOptions: [],

  async run(commandOptions, rawArgs) {
    this.ui.writeLine('hello world');
    let moduleDir = this.project.root + '/node_modules';
    let [projects, links] = partition(await this._findLinkedModules(moduleDir), ({ path }) => {
      return fs.realpathSync(path).indexOf(moduleDir) !== 0
    });
    console.log(JSON.stringify(projects, null, 2));
    console.log(JSON.stringify(links, null, 2));
  },

  async _findLinkedModules(moduleDir) {
    let output = [];
    for (let name of fs.readdirSync(moduleDir)) {
      let modulePath = moduleDir + '/' + name;

      if (/^@/.test(name)) {
        for (let scopedName of fs.readdirSync(modulePath)) {
          let stat = fs.lstatSync(modulePath + '/' + scopedName);
          if (stat.isSymbolicLink()) {
            output.push({
              name: name + '/' + scopedName,
              path: modulePath + '/' + scopedName
            });
          }
        }
      }

      let stat = fs.lstatSync(modulePath);
      if (stat.isSymbolicLink()) {
        output.push({ name, path: modulePath });
      }
    }
    return output;
  }

};
