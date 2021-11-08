import { assertValidRawCard, RawCard, RealmConfig } from '@cardstack/core/src/interfaces';
import { existsSync, readFileSync, outputFileSync, removeSync, writeJsonSync, mkdirSync } from 'fs-extra';
import { join } from 'path';
import walkSync from 'walk-sync';
import { RealmInterface } from '../interfaces';
import { ensureTrailingSlash } from '../utils/path';
import { nanoid } from '../utils/ids';
import RealmManager from '../services/realm-manager';
import { CardstackError, Conflict, NotFound, augmentBadRequest } from '@cardstack/core/src/utils/errors';
import { IndexingOperations } from '../services/search-index';
import { serverLog as logger } from '../utils/logger';

export default class FSRealm implements RealmInterface {
  private url: string;
  private directory: string;
  private logger = logger;
  private manager: RealmManager;

  // constructor(config: RealmConfig, manager: RealmManager, private update: (ops: IndexingOperations) => Promise<void>) {
  constructor(config: RealmConfig, manager: RealmManager) {
    this.url = config.url;
    this.directory = ensureTrailingSlash(config.directory!);
    this.manager = manager;
  }

  // async reindex(ops: IndexingOperations, meta: Meta | undefined): Promise<Meta> {
  async reindex(ops: IndexingOperations): Promise<void> {
    this.logger.log(`Indexing realm: ${this.url}`);

    ops.beginReplaceAll();
    let cards = walkSync(this.directory, { globs: ['**/card.json'] });
    for (let cardPath of cards) {
      let fullCardUrl = new URL(cardPath.replace('card.json', ''), this.url).href;
      this.logger.info(`--> ${fullCardUrl}`);
      let rawCard = await this.read(fullCardUrl);
      ops.save(rawCard);
    }
    ops.finishReplaceAll();
  }

  private onFileChanged() {}

  private buildCardPath(cardURL: string, ...paths: string[]): string {
    return join(this.directory, cardURL.replace(this.url, ''), ...(paths || ''));
  }

  async read(cardURL: string): Promise<RawCard> {
    let dir = this.buildCardPath(cardURL);
    let files: any = {};

    let entries: string[];
    try {
      entries = walkSync(dir, { directories: false });
    } catch (err: any) {
      if (err.code !== 'ENOENT') {
        throw err;
      }
      throw new NotFound(`card ${cardURL} not found`);
    }

    for (let file of entries) {
      let fullPath = join(dir, file);
      files[file] = readFileSync(fullPath, 'utf8');
    }

    let cardJSON = files['card.json'];
    if (!cardJSON) {
      throw new CardstackError(`${cardURL} is missing card.json`);
    }

    delete files['card.json'];
    let card;
    try {
      card = JSON.parse(cardJSON);
    } catch (e: any) {
      throw augmentBadRequest(e);
    }
    Object.assign(card, { files, url: cardURL });
    assertValidRawCard(card);

    return card;
  }

  private payload(raw: Omit<RawCard, 'url'>): Omit<RawCard, 'url' | 'files'> {
    let doc: Omit<RawCard, 'url' | 'files'> = Object.assign({}, raw);
    delete (doc as any).files;
    delete (doc as any).url;
    return doc;
  }

  private ensureCardURL(raw: RawCard | Omit<RawCard, 'url'>): string {
    if ('url' in raw) {
      return raw.url;
    } else {
      return this.url + nanoid();
    }
  }

  async create(raw: RawCard | Omit<RawCard, 'url'>): Promise<RawCard> {
    let url = this.ensureCardURL(raw);
    let cardDir = this.buildCardPath(url);

    try {
      mkdirSync(cardDir);
    } catch (err: any) {
      if (err.code !== 'EEXIST') {
        throw err;
      }
      throw new Conflict(`card ${url} already exists`);
    }
    let completeRawCard: RawCard;
    if ('url' in raw) {
      completeRawCard = raw;
    } else {
      completeRawCard = Object.assign({}, raw, { url });
    }

    this.write(cardDir, completeRawCard);
    return completeRawCard;
  }

  async update(raw: RawCard): Promise<RawCard> {
    let cardDir = this.buildCardPath(raw.url);
    this.write(cardDir, raw);
    return raw;
  }

  private write(cardDir: string, raw: RawCard) {
    let payload = this.payload(raw);
    try {
      writeJsonSync(join(cardDir, 'card.json'), payload);
    } catch (err: any) {
      if (err.code !== 'ENOENT') {
        throw err;
      }
      throw new NotFound(`tried to update card ${raw.url} but it does not exist`);
    }
    if (raw.files) {
      for (let [name, contents] of Object.entries(raw.files)) {
        outputFileSync(join(cardDir, name), contents);
      }
    }
  }

  async delete(cardURL: string): Promise<void> {
    let cardDir = this.buildCardPath(cardURL);
    if (!existsSync(cardDir)) {
      throw new NotFound(`tried to delete ${cardURL} but it does not exist`);
    }
    removeSync(cardDir);
  }
}
