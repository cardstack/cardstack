import StringSchemaJS from '!raw-loader!@cardstack/base-cards/string/schema.js';
import StringEmbedded from '!raw-loader!@cardstack/base-cards/string/embedded.hbs';
import DateSchemaJS from '!raw-loader!@cardstack/base-cards/date/schema.js';
import DateEmbedded from '!raw-loader!@cardstack/base-cards/date/embedded.hbs';
import TagSchemaJS from '!raw-loader!@cardstack/base-cards/tag/schema.js';
import TagEmbedded from '!raw-loader!@cardstack/base-cards/tag/embedded.hbs';
import CommentSchemaJS from '!raw-loader!@cardstack/base-cards/comment/schema.js';
import CommentEmbedded from '!raw-loader!@cardstack/base-cards/comment/embedded.hbs';

import { RawCard } from './interfaces';

export const RAW_BASE_CARDS: RawCard[] = [
  {
    url: 'https://cardstack.com/base/models/string',
    files: {
      'schema.js': StringSchemaJS,
      'embedded.hbs': StringEmbedded,
    },
  },
  {
    url: 'https://cardstack.com/base/models/date',
    files: {
      'schema.js': DateSchemaJS,
      'embedded.hbs': DateEmbedded,
    },
  },
  {
    url: 'https://cardstack.com/base/models/tag',
    files: {
      'schema.js': TagSchemaJS,
      'embedded.hbs': TagEmbedded,
    },
  },
  {
    url: 'https://cardstack.com/base/models/comment',
    files: {
      'schema.js': CommentSchemaJS,
      'embedded.hbs': CommentEmbedded,
    },
  },
];
