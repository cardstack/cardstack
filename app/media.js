import ENV from './config/environment';
import fetch from 'fetch';

export async function fetchCollection(collection) {
  let url =  `${ENV.rootURL}media-registry/api/${collection}.json`;

  let res = await fetch(url);
  return await res.json();
}
