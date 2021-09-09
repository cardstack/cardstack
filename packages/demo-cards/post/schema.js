import { contains } from '@cardstack/types';
import string from 'https://cardstack.com/base/string';
import datetime from 'https://cardstack.com/base/datetime';
export default class Post {
  @contains(string)
  title;

  @contains(string)
  body;

  @contains(datetime)
  createdAt;
}
