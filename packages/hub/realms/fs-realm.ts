import { existsSync, readFileSync, outputFileSync, removeSync, writeJsonSync, mkdirSync } from 'fs-extra';
import { sep, join } from 'path';
import sane from 'sane';
import walkSync from 'walk-sync';

import { assertValidRawCard, RawCard } from '@cardstack/core/src/interfaces';
import { CardstackError, Conflict, NotFound, augmentBadRequest } from '@cardstack/core/src/utils/errors';

import { RealmInterface } from '../interfaces';
import { ensureTrailingSlash } from '../utils/path';
import { nanoid } from '../utils/ids';
import { serverLog as logger } from '../utils/logger';

import { IndexerHandle } from '../services/search-index';
import RealmManager from '../services/realm-manager';

export default class FSRealm implements RealmInterface {
  url: string;
  private directory: string;
  private logger = logger;
  private watcher?: sane.Watcher;

  constructor(url: string, directory: string, private notify: RealmManager['notify'] | undefined) {
    this.url = url;
    this.directory = ensureTrailingSlash(directory);

    if (notify) {
      this.watcher = sane(this.directory);
      this.watcher.on('add', this.onFileChanged.bind(this, 'save'));
      this.watcher.on('change', this.onFileChanged.bind(this, 'save'));
      this.watcher.on('delete', this.onFileChanged.bind(this, 'delete'));
    }
  }

  async teardown() {
    this.watcher?.close();
  }

  // async reindex(ops: IndexingOperations, meta: Meta | undefined): Promise<Meta> {
  async reindex(ops: IndexerHandle): Promise<void> {
    this.logger.log(`Indexing realm: ${this.url}`);

    await ops.beginReplaceAll();
    let cards = walkSync(this.directory, { globs: ['**/card.json'] });
    for (let cardPath of cards) {
      let fullCardUrl = new URL(cardPath.replace('/card.json', ''), this.url).href;
      this.logger.info(`--> ${fullCardUrl}`);
      let rawCard = await this.read(fullCardUrl);
      await ops.save(rawCard);
    }
    await ops.finishReplaceAll();
  }

  private onFileChanged(action: 'save' | 'delete', filepath: string) {
    let segments = filepath.split(sep);
    if (!this.notify || shouldIgnoreChange(segments)) {
      // top-level files in the realm are not cards, we're assuming all
      // cards are directories under the realm.
      return;
    }
    let url = new URL(segments[0] + '/', this.url).href;
    this.notify(url, action);
  }

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

function shouldIgnoreChange(segments: string[]): boolean {
  // top-level files in the realm are not cards, we're assuming all
  // cards are directories under the realm.
  return segments.length < 2;
}
