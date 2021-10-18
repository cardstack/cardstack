import { contains } from '@cardstack/types';
import string from 'https://cardstack.com/base/string';

export default class Profile {
  @contains(string)
  username;

  @contains(string)
  url;

  @contains(string)
  tag;

  @contains(string)
  description;
}
