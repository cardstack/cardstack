import { hubURL, defaultBranch } from '@cardstack/plugin-utils/environment';
import fetch from 'fetch';
import Service from '@ember/service';
import { computed } from '@ember/object';
import { getOwner } from '@ember/application';

export default Service.extend({
  config: computed(function() {
    return getOwner(this).resolveRegistration('config:environment');
  }),
  refreshCode(branch=defaultBranch) {
    return fetch(`${hubURL}/codegen/${branch}/${this.get('config.modulePrefix')}`)
      .then(response => response.text())
      .then(source => load(source));
  }
});

function load(source) {
  /* eslint no-unused-vars: 0 */
  function define(moduleName) {
    if (window.requirejs.entries[moduleName]) {
      window.requirejs.unsee(moduleName);
    }
    window.define.apply(this, arguments);
  }
  eval(source);
}
