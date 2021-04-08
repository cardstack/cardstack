import { contains } from '@cardstack/types';
import string from 'https://cardstack.com/base/string';
export default class Post {
  @contains(string)
  title;

  @contains(string)
  body;
}
