import {
  assertValidRawCard,
  RawCard,
  RealmConfig,
} from '@cardstack/core/src/interfaces';
import {
  existsSync,
  readFileSync,
  readJsonSync,
  removeSync,
  writeJsonSync,
} from 'fs-extra';
import { join } from 'path';
import walkSync from 'walk-sync';
import { RealmInterface } from './interfaces';
import { NotFound } from './middleware/errors';
import { ensureTrailingSlash } from './utils/path';

export default class Realm implements RealmInterface {
  url: string;
  directory: string;

  constructor(config: RealmConfig) {
    this.url = config.url;
    this.directory = ensureTrailingSlash(config.directory);
  }

  // Currently hardcoded to numeric incrementing, ie: post-1, post-2, etc
  // Eventually this will be configurable by each realm
  getNextID(url: string): string {
    // IF url has no number, append
    // IF url has number, increment
    // TODO: Find existing cards for the URL and guess next
    return url;
  }

  doesCardExist(cardURL: string): boolean {
    let cardLocation = join(this.directory, cardURL.replace(this.url, ''));
    return existsSync(cardLocation);
  }

  private getRawCardLocation(cardURL: string): string {
    let cardLocation = join(this.directory, cardURL.replace(this.url, ''));

    if (existsSync(cardLocation)) {
      return cardLocation;
    }

    throw new NotFound(`${cardURL} is not a card we know about`);
  }

  getRawCard(cardURL: string): RawCard {
    let dir = this.getRawCardLocation(cardURL);
    let files: any = {};

    for (let file of walkSync(dir, {
      directories: false,
    })) {
      let fullPath = join(dir, file);
      files[file] = readFileSync(fullPath, 'utf8');
    }

    let cardJSON = files['card.json'];
    if (!cardJSON) {
      throw new Error(`${cardURL} is missing card.json`);
    }

    delete files['card.json'];
    let card = JSON.parse(cardJSON);
    Object.assign(card, { files, url: cardURL });
    assertValidRawCard(card);

    return card;
  }

  updateCardData(cardURL: string, attributes: any): void {
    let fullPath = join(this.getRawCardLocation(cardURL), 'card.json');

    let card = readJsonSync(fullPath);
    card.data = Object.assign(card.data, attributes);
    writeJsonSync(fullPath, card);
  }

  deleteCard(cardURL: string) {
    let cardDir = this.getRawCardLocation(cardURL);
    removeSync(cardDir);
  }
}
