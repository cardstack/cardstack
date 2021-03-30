import StringSchemaJS from '!raw-loader!@cardstack/base-cards/string/schema.js';
import StringEmbedded from '!raw-loader!@cardstack/base-cards/string/embedded.js';
import DateSchemaJS from '!raw-loader!@cardstack/base-cards/date/schema.js';
import DateEmbedded from '!raw-loader!@cardstack/base-cards/date/embedded.js';
import TagSchemaJS from '!raw-loader!@cardstack/base-cards/tag/schema.js';
import TagEmbedded from '!raw-loader!@cardstack/base-cards/tag/embedded.js';
import CommentSchemaJS from '!raw-loader!@cardstack/base-cards/comment/schema.js';
import CommentEmbedded from '!raw-loader!@cardstack/base-cards/comment/embedded.js';

import { RawCard } from './interfaces';

export const RAW_BASE_CARDS: RawCard[] = [
  {
    url: 'https://cardstack.com/base/models/string',
    files: {
      'schema.js': StringSchemaJS,
      'embedded.js': StringEmbedded,
    },
  },
  {
    url: 'https://cardstack.com/base/models/date',
    files: {
      'schema.js': DateSchemaJS,
      'embedded.js': DateEmbedded,
    },
  },
  {
    url: 'https://cardstack.com/base/models/tag',
    files: {
      'schema.js': TagSchemaJS,
      'embedded.js': TagEmbedded,
    },
  },
  {
    url: 'https://cardstack.com/base/models/comment',
    files: {
      'schema.js': CommentSchemaJS,
      'embedded.js': CommentEmbedded,
    },
  },
];
