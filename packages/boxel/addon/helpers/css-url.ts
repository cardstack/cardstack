import { helper } from '@ember/component/helper';
import { htmlSafe } from '@ember/string';
import { SafeString } from '@ember/template/-private/handlebars';

export function cssUrl(
  propertyName: string,
  url: string
): SafeString | undefined {
  if (!/^[-a-zA-Z]+$/.test(propertyName)) {
    throw new Error(`Potentially unsafe property name ${propertyName}`);
  }
  if (!url) {
    return;
  }

  // Step 1: Make sure there are no un-encoded double quotes
  let encodedURL = url.replace(/"/g, '%22');

  // Step 2: if there is a protocol present, whitelist only http and
  // https. This prevents shenanigans like "javascript://" URLs (which
  // certain older browsers may execute).
  let m = /^([^:]+):/.exec(encodedURL);
  if (m) {
    let proto = m[1].toLowerCase();
    if (proto !== 'http' && proto !== 'https') {
      throw new Error(`disallowed protocol in css url: ${url}`);
    }
  }

  // Step 3: Use our own double quotes, which the url cannot break out
  // of due to Step 1.
  return htmlSafe(`${propertyName}: url("${encodedURL}")`);
}

function asHelper(params: [string, string]) {
  return cssUrl(...params);
}

export default helper(asHelper);
