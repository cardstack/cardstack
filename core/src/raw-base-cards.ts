import StringCard from '!@cardstack/card-loader!@cardstack/base-cards/string/card.json';
import DateCard from '!@cardstack/card-loader!@cardstack/base-cards/date/card.json';
import TagCard from '!@cardstack/card-loader!@cardstack/base-cards/tag/card.json';
import CommentCard from '!@cardstack/card-loader!@cardstack/base-cards/comment/card.json';

import { RawCard } from './interfaces';

export const RAW_BASE_CARDS: RawCard[] = [
  StringCard,
  DateCard,
  TagCard,
  CommentCard,
];
