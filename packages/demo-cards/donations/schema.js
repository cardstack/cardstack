import { contains } from '@cardstack/types';
import string from 'https://cardstack.com/base/string';

export default class Donations {
  @contains(string)
  title;

  @contains(string)
  description;
}
