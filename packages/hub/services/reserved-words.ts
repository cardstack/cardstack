import autoBind from 'auto-bind';
import forbiddenIds from '../assets/forbidden-ids.json';

export default class ReservedWords {
  lowerCaseAlphaNumericTransform = (str: string) => str.toLowerCase().replace(/[^a-z0-9]/g, '');
  reservedWords = Object.entries(forbiddenIds)
    .filter(([k]) => k !== 'profanity')
    .flatMap(([_k, v]) => v);
  profanity = forbiddenIds.profanity.map((k) => k.toLowerCase());

  constructor() {
    autoBind(this);
  }

  isProfane(word: string, transform?: (reservedWord: string) => string) {
    let lowercased = word.toLowerCase();
    if (transform) return this.profanity.some((reservedWord) => lowercased.includes(transform(reservedWord)));
    else return this.profanity.some((reservedWord) => lowercased.includes(reservedWord));
  }

  isReserved(word: string, transform?: (reservedWord: string) => string) {
    if (this.isProfane(word, transform)) return true;
    if (transform) return this.reservedWords.some((reservedWord) => word === transform(reservedWord));
    else return this.reservedWords.some((reservedWord) => word === reservedWord);
  }
}

declare module '@cardstack/di' {
  interface KnownServices {
    'reserved-words': ReservedWords;
  }
}
