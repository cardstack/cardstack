import { Writer } from '@cardstack/hub';
import { Session } from '@cardstack/hub';
import { UpstreamDocument, UpstreamIdentity } from '@cardstack/hub';
import { inject } from '@cardstack/hub/dependency-injection';
import { AddressableCard } from '@cardstack/hub';
import crypto from 'crypto';
import { pathExistsSync, removeSync, outputFileSync } from 'fs-extra';
import { join } from 'path';
import { writeCard } from '@cardstack/hub';
import { upstreamIdToCardDirName } from '@cardstack/hub';

export default class FilesWriter implements Writer {
  filesTracker = inject('filesTracker');

  constructor(private realmCard: AddressableCard) {}

  async create(_session: Session, doc: UpstreamDocument, upstreamId: UpstreamIdentity | null) {
    let realmDir = await this.realmCard.value('directory');
    let cardDirName: string;
    if (!upstreamId) {
      cardDirName = this.pickId(realmDir);
    } else {
      cardDirName = upstreamIdToCardDirName(upstreamId);
    }

    let cardDir = join(realmDir, cardDirName);
    let saved = await this.createOrUpdateCard(cardDir, doc);
    return { saved, id: upstreamId ?? cardDirName };
  }

  async update(_session: Session, id: UpstreamIdentity, doc: UpstreamDocument) {
    let realmDir = await this.realmCard.value('directory');
    let cardDirName = upstreamIdToCardDirName(id);
    let cardDir = join(realmDir, cardDirName);
    removeSync(cardDir);
    let saved = await this.createOrUpdateCard(cardDir, doc);
    return saved;
  }

  async delete(_session: Session, id: UpstreamIdentity) {
    let realmDir = await this.realmCard.value('directory');
    let cardDirName = upstreamIdToCardDirName(id);
    let cardDir = join(realmDir, cardDirName);
    removeSync(cardDir);
  }

  private async createOrUpdateCard(cardDir: string, doc: UpstreamDocument): Promise<UpstreamDocument> {
    await writeCard(cardDir, doc.jsonapi, async (path: string, content: string) => {
      outputFileSync(path, content, 'utf8');
    });
    let meta = Object.assign({}, doc.jsonapi.data.meta);
    meta.cardDir = cardDir;
    doc.jsonapi.data.meta = meta;
    return doc;
  }

  private pickId(realmDir: string): string {
    while (true) {
      let id = crypto.randomBytes(20).toString('hex');
      if (!pathExistsSync(join(realmDir, id))) {
        return id;
      }
    }
  }
}
