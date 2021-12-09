import { existsSync, readFileSync, outputFileSync, removeSync, writeJsonSync, mkdirSync } from 'fs-extra';
import { sep, join } from 'path';
import sane from 'sane';
import walkSync from 'walk-sync';

import { assertValidRawCard, CardId, NewRawCard, RawCard } from '@cardstack/core/src/interfaces';
import { CardstackError, Conflict, NotFound, augmentBadRequest } from '@cardstack/core/src/utils/errors';
import { cardURL, ensureTrailingSlash } from '@cardstack/core/src/utils';

import { RealmInterface } from '../interfaces';
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
  }

  async ready() {
    if (this.notify) {
      let watcher = sane(this.directory);
      await new Promise<void>((resolve) => watcher.once('ready', resolve));
      watcher.on('add', this.onFileChanged.bind(this, 'save'));
      watcher.on('change', this.onFileChanged.bind(this, 'save'));
      watcher.on('delete', this.onFileChanged.bind(this, 'delete'));
      this.watcher = watcher;
    }
  }

  async teardown() {
    this.watcher?.close();
  }

  // async reindex(ops: IndexingOperations, meta: Meta | undefined): Promise<Meta> {
  async reindex(ops: IndexerHandle): Promise<void> {
    this.logger.info(`Indexing realm: ${this.url}`);

    await ops.beginReplaceAll();
    let cards = walkSync(this.directory, { globs: ['**/card.json'] });
    for (let cardPath of cards) {
      let id = cardPath.replace('/card.json', '');
      this.logger.info(`--> ${id}`);
      let rawCard = await this.read({ id, realm: this.url });
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

  private buildCardPath(cardId: CardId, ...paths: string[]): string {
    if (cardId.realm !== this.url) {
      throw new Error(`realm ${this.url} does not contain card ${cardURL(cardId)}`);
    }
    return join(this.directory, cardId.id, ...(paths || ''));
  }

  async read(cardId: CardId): Promise<RawCard> {
    let dir = this.buildCardPath(cardId);
    let files: any = {};

    let entries: string[];
    try {
      entries = walkSync(dir, { directories: false });
    } catch (err: any) {
      if (err.code !== 'ENOENT') {
        throw err;
      }
      throw new NotFound(`card ${cardId.id} not found`);
    }

    for (let file of entries) {
      let fullPath = join(dir, file);
      files[file] = readFileSync(fullPath, 'utf8');
    }

    let cardJSON = files['card.json'];
    if (!cardJSON) {
      throw new CardstackError(`${cardId.id} is missing card.json`);
    }

    delete files['card.json'];
    let card;
    try {
      card = JSON.parse(cardJSON);
    } catch (e: any) {
      throw augmentBadRequest(e);
    }
    Object.assign(card, { files, id: cardId.id, realm: cardId.realm });
    assertValidRawCard(card);

    return card;
  }

  private payload(raw: Omit<RawCard, 'url'>): Omit<RawCard, 'url' | 'files'> {
    let doc: Omit<RawCard, 'url' | 'files'> = Object.assign({}, raw);
    delete (doc as any).files;
    delete (doc as any).url;
    return doc;
  }

  private ensureCardId(raw: NewRawCard): CardId {
    if (raw.id) {
      return { id: raw.id, realm: this.url };
    } else {
      return { id: nanoid(), realm: this.url };
    }
  }

  async create(raw: NewRawCard): Promise<RawCard> {
    let cardId = this.ensureCardId(raw);
    let cardDir = this.buildCardPath(cardId);

    try {
      mkdirSync(cardDir);
    } catch (err: any) {
      if (err.code !== 'EEXIST') {
        throw err;
      }
      throw new Conflict(`card ${cardURL(cardId)} already exists`);
    }
    let completeRawCard: RawCard;
    if ('id' in raw) {
      completeRawCard = raw as RawCard;
    } else {
      completeRawCard = Object.assign({}, raw, { ...cardId });
    }

    this.write(cardDir, completeRawCard);
    return completeRawCard;
  }

  async update(raw: RawCard): Promise<RawCard> {
    let cardDir = this.buildCardPath(raw);
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
      throw new NotFound(`tried to update card ${cardURL(raw)} but it does not exist`);
    }
    if (raw.files) {
      for (let [name, contents] of Object.entries(raw.files)) {
        outputFileSync(join(cardDir, name), contents);
      }
    }
  }

  async delete(cardId: CardId): Promise<void> {
    let cardDir = this.buildCardPath(cardId);
    if (!existsSync(cardDir)) {
      throw new NotFound(`tried to delete ${cardURL(cardId)} but it does not exist`);
    }
    removeSync(cardDir);
  }
}

function shouldIgnoreChange(segments: string[]): boolean {
  // top-level files in the realm are not cards, we're assuming all
  // cards are directories under the realm.
  return segments.length < 2;
}
