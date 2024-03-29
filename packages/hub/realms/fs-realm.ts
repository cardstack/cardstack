import { existsSync, readFileSync, outputFileSync, removeSync, writeJsonSync, mkdirSync, statSync } from 'fs-extra';
import { sep, join } from 'path';
import sane from 'sane';
import walkSync from 'walk-sync';

import { assertValidRawCard, CardId, Unsaved, RawCard } from '@cardstack/core/src/interfaces';
import { CardstackError, Conflict, NotFound, augmentBadRequest } from '@cardstack/core/src/utils/errors';
import { cardURL, ensureTrailingSlash } from '@cardstack/core/src/utils';

import { RealmInterface } from '../interfaces';
import { nanoid } from '../utils/ids';
import logger from '@cardstack/logger';
import Logger from '@cardstack/logger/src/logger';

import { IndexerHandle } from '../services/search-index';
import RealmManager from '../services/realm-manager';

interface Meta {
  mtime: number;
  pid: number;
}

export default class FSRealm implements RealmInterface<Meta> {
  url: string;
  private directory: string;
  private watcher?: sane.Watcher;
  private log: Logger;

  private recentWrites = new Map<string, number>();
  private recentDeleted = new Set<string>();

  constructor(url: string, directory: string, private notify: RealmManager['notify'] | undefined) {
    this.url = url;
    this.directory = ensureTrailingSlash(directory);
    this.log = logger(`hub/fs-realm[${url}]`);
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

  async reindex(ops: IndexerHandle, meta: Meta | null): Promise<Meta> {
    let fullReindex = meta?.pid !== process.pid;
    let newestMtime = 0;

    if (fullReindex) {
      await ops.beginReplaceAll();
    }
    this.log.trace('fullReindex=%s', fullReindex);
    let cards = walkSync.entries(this.directory, {
      globs: ['**/card.json'],
      fs: undefined as any,
    });
    for (let { relativePath: cardPath, mtime } of cards) {
      newestMtime = Math.max(newestMtime, mtime);
      let id = cardPath.replace('/card.json', '');
      if (fullReindex || meta?.mtime == null || meta.mtime < mtime) {
        this.log.trace(`indexing %s`, id);
        let rawCard = await this.read({ id, realm: this.url });
        await ops.save(rawCard);
      } else {
        this.log.trace(`skipping %s`, id);
      }
    }
    if (fullReindex) {
      await ops.finishReplaceAll();
    }
    return { mtime: newestMtime, pid: process.pid };
  }

  private onFileChanged(action: 'save' | 'delete', filepath: string) {
    this.log.trace('onFileChange', filepath);
    let segments = filepath.split(sep);
    if (!this.notify || shouldIgnoreChange(segments)) {
      // top-level files in the realm are not cards, we're assuming all
      // cards are directories under the realm.
      return;
    }

    if (action === 'save') {
      // echo suppression based on close-enough mtime of the new file
      let fullpath = join(this.directory, filepath);
      let lastMTime = this.recentWrites.get(fullpath);
      if (lastMTime != null && statSync(fullpath).mtime.getTime() < lastMTime + 10) {
        this.log.trace('onChangeNotifySuppressed');
        return;
      }
    }

    if (action === 'delete') {
      // echo suppression for recently deleted files
      let cardDir = join(this.directory, segments[0]);
      // todo: this is good enough for now because we only delete whole cards,
      // but we need to implement single file deletion too and that needs to get
      // tracked separately
      if (this.recentDeleted.has(cardDir)) {
        this.log.trace('onChangeNotifySuppressed');
        return;
      }
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

  private ensureCardId(raw: RawCard<Unsaved>): CardId {
    if (raw.id) {
      return { id: raw.id, realm: this.url };
    } else {
      return { id: nanoid(), realm: this.url };
    }
  }

  async create(raw: RawCard<Unsaved>): Promise<RawCard> {
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
    if (raw.id) {
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
    let names = [];
    try {
      let filename = join(cardDir, 'card.json');
      writeJsonSync(filename, payload);
      names.push(filename);
    } catch (err: any) {
      if (err.code !== 'ENOENT') {
        throw err;
      }
      throw new NotFound(`tried to update card ${cardURL(raw)} but it does not exist`);
    }
    if (raw.files) {
      for (let [name, contents] of Object.entries(raw.files)) {
        let filename = join(cardDir, name);
        outputFileSync(filename, contents);
        names.push(filename);
      }
    }
    let time = Date.now();
    for (let filename of names) {
      this.recentWrites.set(filename, time);
    }
    this.recentDeleted.delete(cardDir);
  }

  async delete(cardId: CardId): Promise<void> {
    let cardDir = this.buildCardPath(cardId);
    if (!existsSync(cardDir)) {
      throw new NotFound(`tried to delete ${cardURL(cardId)} but it does not exist`);
    }
    removeSync(cardDir);
    this.recentDeleted.add(cardDir);
  }
}

function shouldIgnoreChange(segments: string[]): boolean {
  // top-level files in the realm are not cards, we're assuming all
  // cards are directories under the realm.
  return segments.length < 2;
}
