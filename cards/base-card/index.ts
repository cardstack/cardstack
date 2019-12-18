import { SingleResourceDoc } from 'jsonapi-typescript';
import { join } from 'path';
import { readFileSync } from 'fs';

const embeddedCss = readFileSync(join(__dirname, 'css', 'embedded.css'), 'utf-8');
const isolatedCss = readFileSync(join(__dirname, 'css', 'isolated.css'), 'utf-8');

let card: SingleResourceDoc = {
  data: {
    id: 'local-hub::@cardstack/base-card',
    type: 'cards',
    // TODO after we have the ability to perform ember-cli builds on browser assets emitted from cards
    // make sure to move the default card component js and template into the base card.
    attributes: {
      isolatedCSS: isolatedCss,
      embeddedCSS: embeddedCss,
    },
    relationships: {
      adoptedFrom: { data: null },
      fields: { data: [] },
      model: { data: { type: 'local-hub::@cardstack/base-card', id: 'local-hub::@cardstack/base-card' } },
    },
  },
  included: [
    {
      id: 'local-hub::@cardstack/base-card',
      type: 'local-hub::@cardstack/base-card',
    },
  ],
};

export = card;
