import Service from '@ember/service';
import { tracked } from '@glimmer/tracking';
import { AddressableCard } from '@cardstack/hub';
import sortBy from 'lodash/sortBy';
import { set } from '@ember/object';

type Format = 'isolated' | 'embedded';

export interface CssEntry {
  cards: AddressableCard[];
  format: Format;
}

export default class CssService extends Service {
  @tracked cssMap = new Map<string, CssEntry>();

  addCard(card: AddressableCard, format: Format, css: string) {
    if (css == null) {
      return;
    }

    this.removeCard(card, format, false);

    let cssEntry = this.cssMap.get(css);
    if (!cssEntry) {
      cssEntry = { cards: [card], format };
      this.cssMap.set(css, cssEntry);
    } else {
      cssEntry.cards.push(card);
      set(cssEntry, 'cards', sortBy(cssEntry.cards, 'canonicalURL')); // this is so the tests can be deterministic
    }

    this.cssMap = this.cssMap;
  }

  // We are using the card's nonce to be able to distinguish between different
  // instances of the same card that appear on the page. This way if, for
  // instance, mulitple embedded views of the same card appear on the page,
  // removing one of the card instances from the page doesn't remove all of the
  // css on the page for the card.
  removeCard(card: AddressableCard, format: Format, invalidateGlimmer = true) {
    let entries =
      [...this.cssMap].filter(
        ([_key, value]) =>
          value.format === format &&
          value.cards
            .map(c => `${c.canonicalURL}:${format === 'embedded' ? c.nonce : ''}`)
            .includes(`${card.canonicalURL}:${format === 'embedded' ? card.nonce : ''}`)
      ) || [];
    for (let [css, cssEntry] of entries) {
      if (!cssEntry) {
        continue;
      }
      if (cssEntry.cards.length === 1) {
        this.cssMap.delete(css);
      } else if (cssEntry.cards.length > 1) {
        cssEntry.cards.splice(
          cssEntry.cards.map(c => `${c.canonicalURL}:${c.nonce}`).indexOf(`${card.canonicalURL}:${card.nonce}`),
          1
        );
        set(cssEntry, 'cards', sortBy(cssEntry.cards, 'canonicalURL')); // this is so the tests can be deterministic
      }
    }

    if (invalidateGlimmer) {
      this.cssMap = this.cssMap;
    }
  }
}
