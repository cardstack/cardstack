import { contains, containsMany } from '@cardstack/types';
import Link from 'https://demo.com/link';
import string from 'https://cardstack.com/base/string';

export default class Links {
  @contains(string)
  title;

  @containsMany(Link)
  links;
}
