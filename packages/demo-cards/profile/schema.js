import { contains } from '@cardstack/types';
import string from 'https://cardstack.com/base/string';

export default class Profile {
  @contains(string)
  profilePicture;

  @contains(string)
  name;

  @contains(string)
  url;

  @contains(string)
  category;

  @contains(string)
  description;
}
