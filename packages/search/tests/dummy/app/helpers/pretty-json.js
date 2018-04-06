import { helper as buildHelper } from '@ember/component/helper';

export function prettyJson([value]) {
  return JSON.stringify(value, null, 2);
}

export default buildHelper(prettyJson);
