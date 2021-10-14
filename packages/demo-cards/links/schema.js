import { containsMany } from '@cardstack/types';
import Link from 'https://demo.com/link';

export default class CardSpaceLayout {
  @containsMany(Link)
  links;
}
