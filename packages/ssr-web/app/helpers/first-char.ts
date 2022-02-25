import { helper } from '@ember/component/helper';

export function firstChar([str]: [string] /*, hash*/) {
  if (!str || typeof str !== 'string') {
    return;
  }

  // The string iterator (and by extension methods that use it, including Array.from)
  // can iterate over astral code points (code points that are actually more than one code unit combined)
  // This is necessary to handle emoji
  // Detailed explanation: https://mathiasbynens.be/notes/javascript-unicode
  return Array.from(str.trim())[0];
}

export default helper(firstChar);
