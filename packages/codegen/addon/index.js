import { hubURL } from '@cardstack/hub/environment';
import fetch from 'fetch';

export function refreshCode(branch) {
  return fetch(`${hubURL}/codegen/${branch}`)
    .then(response => response.text())
    .then(source => {
      console.log(source);
    });
}
