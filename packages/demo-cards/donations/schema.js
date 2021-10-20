import { contains } from '@cardstack/types';
import string from 'https://cardstack.com/base/string';

export default class Profile {
  @contains(string)
  title;

  @contains(string)
  description;
}
