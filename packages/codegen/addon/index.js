import { hubURL } from '@cardstack/hub/environment';
import fetch from 'fetch';

export function refreshCode(branch) {
  return fetch(`${hubURL}/codegen/${branch}`)
    .then(response => response.text())
    .then(source => load(source));
}

function load(source) {
  /* eslint no-unused-vars: 0 */
  function define(moduleName) {
    window.requirejs.unsee(moduleName);
    window.define.apply(this, arguments);
  }
  eval(source);
}
