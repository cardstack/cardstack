import { Conflict } from '../middleware/errors';
import { assertValidRawCard, RawCard, RealmConfig } from '@cardstack/core/src/interfaces';
import { ensureDirSync, existsSync, readFileSync, readJsonSync, removeSync, writeJsonSync } from 'fs-extra';
import { join } from 'path';
import walkSync from 'walk-sync';
import { RealmInterface } from '../interfaces';
import { NotFound } from '../middleware/errors';
import { ensureTrailingSlash } from '../utils/path';
import RealmManager from '../realm-manager';
import { nanoid } from '../utils/ids';

export default class FSRealm implements RealmInterface {
  url: string;
  directory: string;
  manager: RealmManager;

  constructor(config: RealmConfig, manager: RealmManager) {
    this.url = config.url;
    this.directory = ensureTrailingSlash(config.directory!);
    this.manager = manager;
  }

  doesCardExist(cardURL: string): boolean {
    let cardLocation = join(this.directory, cardURL.replace(this.url, ''));
    return existsSync(cardLocation);
  }

  private buildCardPath(cardURL: string, ...paths: string[]): string {
    return join(this.directory, cardURL.replace(this.url, ''), ...(paths || ''));
  }

  private getRawCardLocation(cardURL: string): string {
    let cardLocation = this.buildCardPath(cardURL);

    if (existsSync(cardLocation)) {
      return cardLocation;
    }

    throw new NotFound(`${cardURL} is not a card we know about`);
  }

  private ensureIDIsUnique(url: string): void {
    let path = this.buildCardPath(url);
    if (existsSync(path)) {
      throw new Conflict(`Card with that ID already exists: ${url}`);
    }
  }

  async getRawCard(cardURL: string): Promise<RawCard> {
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

  async createDataCard(data: any, adoptsFrom: string, cardURL?: string): Promise<RawCard> {
    if (!adoptsFrom) {
      throw new Error('Card needs a parent!');
    }

    if (!this.manager.doesCardExist(adoptsFrom)) {
      throw new NotFound(`Parent card does not exist: ${adoptsFrom}`);
    }

    if (!cardURL) {
      cardURL = await this.generateIdFromParent(adoptsFrom);
    } else {
      this.ensureIDIsUnique(cardURL);
    }

    let cardDir = this.buildCardPath(cardURL);
    ensureDirSync(cardDir);

    let card: RawCard = {
      url: cardURL,
      adoptsFrom,
      data,
    };

    assertValidRawCard(card);
    writeJsonSync(join(cardDir, 'card.json'), card);

    return card;
  }

  private generateIdFromParent(url: string): string {
    let name = url.replace(this.url, '');
    let id = nanoid();
    return `${this.url}${name}-${id}`;
  }

  async updateCardData(cardURL: string, attributes: any): Promise<RawCard> {
    let cardJSONPath = join(this.getRawCardLocation(cardURL), 'card.json');

    let card = readJsonSync(cardJSONPath);
    card.data = Object.assign(card.data, attributes);
    writeJsonSync(cardJSONPath, card);
    Object.assign(card, { url: cardURL });
    assertValidRawCard(card);
    return card;
  }

  deleteCard(cardURL: string) {
    let cardDir = this.getRawCardLocation(cardURL);
    removeSync(cardDir);
  }
}
