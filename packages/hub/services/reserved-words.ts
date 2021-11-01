import autoBind from 'auto-bind';
import forbiddenIds from '../assets/forbidden-ids.json';

export default class ReservedWords {
  constructor() {
    autoBind(this);
  }

  get reservedWords() {
    return Object.entries(forbiddenIds)
      .filter(([k]) => k !== 'profanity')
      .flatMap(([_k, v]) => v);
  }

  get profanity() {
    return forbiddenIds.profanity;
  }

  isProfane(word: string, transform?: (reservedWord: string) => string) {
    if (transform) return this.profanity.some((reservedWord) => word.includes(transform(reservedWord)));
    else return this.profanity.some((reservedWord) => word.includes(reservedWord));
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
