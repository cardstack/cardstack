import StringSchemaJS from '!raw-loader!@cardstack/base-cards/string/schema.js';
import StringEmbedded from '!raw-loader!@cardstack/base-cards/string/embedded.js';
import DateSchemaJS from '!raw-loader!@cardstack/base-cards/date/schema.js';
import DateEmbedded from '!raw-loader!@cardstack/base-cards/date/embedded.js';

import { RawCard } from './interfaces';

export const RAW_BASE_CARDS: RawCard[] = [
  {
    url: 'https://cardstack.com/base/string',
    schema: 'schema.js',
    embedded: 'embedded.js',
    files: {
      'schema.js': StringSchemaJS,
      'embedded.js': StringEmbedded,
    },
  },
  {
    url: 'https://cardstack.com/base/date',
    schema: 'schema.js',
    embedded: 'embedded.js',
    files: {
      'schema.js': DateSchemaJS,
      'embedded.js': DateEmbedded,
    },
  },
];
