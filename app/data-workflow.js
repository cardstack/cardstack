import ENV from './config/environment';
import fetch from 'fetch';

export async function fetchData(data) {
  let url =  `${ENV.rootURL}workflow/api/${data}.json`;

  let res = await fetch(url);
  return await res.json();
}
