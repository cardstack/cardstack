import { ScopedCardService } from '../../cards-service';
import { myOrigin } from '../../origin';
import { CARDSTACK_PUBLIC_REALM } from '../../realm';
import { Session } from '../../session';
import { createTestEnv, TestEnv } from '../helpers';
import { cardDocument } from '../../card-document';
import { dir as mkTmpDir, DirectoryResult } from 'tmp-promise';
import { existsSync, readJSONSync, readFileSync } from 'fs-extra';
import { AddressableCard } from '../../card';
import { join } from 'path';

describe('hub/files-realm-writer', function() {
  let env: TestEnv;
  let service: ScopedCardService;
  let filesRealm = `${myOrigin}/api/realms/test-files-realm`;
  let filesPath: string;
  let tmpDir: DirectoryResult;

  beforeEach(async function() {
    env = await createTestEnv();
    service = await (await env.container.lookup('cards')).as(Session.EVERYONE);

    tmpDir = await mkTmpDir({ unsafeCleanup: true });
    filesPath = tmpDir.path;
    let filesDoc = cardDocument()
      .adoptingFrom({ csRealm: CARDSTACK_PUBLIC_REALM, csId: 'files-realm' })
      .withAttributes({ directory: filesPath, csId: filesRealm, watcherEnabled: false });

    await service.create(`${myOrigin}/api/realms/meta`, filesDoc.jsonapi);
  });

  afterEach(async function() {
    await env.destroy();
    await tmpDir.cleanup();
  });

  it('can create a card', async function() {
    let doc = cardDocument().withAttributes({
      csDescription: 'new card',
      csFiles: { inner: { 'example.hbs': 'Hello World' } },
    });

    let card = await service.create(filesRealm, doc.jsonapi);
    let name = serializedCardName(card);
    let cardJsonFile = join(filesPath, name, 'card.json');
    expect(existsSync(cardJsonFile)).to.equal(true, 'The card.json file exists');
    let cardJson = readJSONSync(cardJsonFile);
    expect(cardJson.data.attributes.csDescription).to.equal('new card');

    let innerCardFileName = join(filesPath, name, 'inner', 'example.hbs');
    expect(existsSync(innerCardFileName)).to.equal(true, 'The inner card csFile exists');
    expect(readFileSync(innerCardFileName, 'utf8')).to.equal('Hello World');

    card = await service.get(card);
    expect(card.csDescription).to.equal('new card');
  });

  it('does not write csRealm to serialized card.json in filesystem', async function() {
    let doc = cardDocument().withAttributes({
      csDescription: 'new card',
    });

    let card = await service.create(filesRealm, doc.jsonapi);
    let name = serializedCardName(card);
    let cardJsonFile = join(filesPath, name, 'card.json');
    let cardJson = readJSONSync(cardJsonFile);
    expect(cardJson.data.attributes.csRealm).to.be.undefined;
  });

  it('can update a card with changed inner csFile', async function() {
    let card = await service.create(
      filesRealm,
      cardDocument().withAttributes({
        csDescription: 'my card',
        csFiles: { inner: { 'example.hbs': 'Hello World' } },
      }).jsonapi
    );

    let doc = card.document.withAttributes({
      csDescription: 'updated card',
      csFiles: { inner: { 'example.hbs': 'Hello Mars' } },
    });
    card = await service.update(card, doc.jsonapi);

    let name = serializedCardName(card);
    let cardJsonFile = join(filesPath, name, 'card.json');
    expect(existsSync(cardJsonFile)).to.equal(true, 'The card.json file exists');
    let cardJson = readJSONSync(cardJsonFile);
    expect(cardJson.data.attributes.csDescription).to.equal('updated card');
    expect(cardJson.data.attributes.csRealm).to.be.undefined;

    let innerCardFileName = join(filesPath, name, 'inner', 'example.hbs');
    expect(existsSync(innerCardFileName)).to.equal(true, 'The inner card csFile exists');
    expect(readFileSync(innerCardFileName, 'utf8')).to.equal('Hello Mars');

    card = await service.get(card);
    expect(card.csDescription).to.equal('updated card');
    expect(card.csFiles).to.deep.equal({ inner: { 'example.hbs': 'Hello Mars' } });
  });

  it('can update a card with new inner csFile', async function() {
    let card = await service.create(
      filesRealm,
      cardDocument().withAttributes({
        csDescription: 'my card',
        csFiles: { inner: { 'example.hbs': 'Hello World' } },
      }).jsonapi
    );

    let doc = card.document.withAttributes({
      csFiles: {
        'example.css': 'literally the best style',
        inner: { 'example.hbs': 'Hello World' },
      },
    });
    card = await service.update(card, doc.jsonapi);

    let name = serializedCardName(card);
    let innerCardFileName = join(filesPath, name, 'example.css');
    expect(existsSync(innerCardFileName)).to.equal(true, 'The inner card csFile exists');
    expect(readFileSync(innerCardFileName, 'utf8')).to.equal('literally the best style');

    card = await service.get(card);
    expect(card.csFiles).to.deep.equal({
      'example.css': 'literally the best style',
      inner: { 'example.hbs': 'Hello World' },
    });
  });

  it('can update a card with deleted inner csFile', async function() {
    let card = await service.create(
      filesRealm,
      cardDocument().withAttributes({
        csDescription: 'my card',
        csFiles: { inner: { 'example.hbs': 'Hello World' } },
      }).jsonapi
    );

    let doc = card.document.withAttributes({
      csFiles: {},
    });
    card = await service.update(card, doc.jsonapi);

    let name = serializedCardName(card);
    let innerCardFileName = join(filesPath, name, 'inner', 'example.hbs');
    expect(existsSync(innerCardFileName)).to.equal(false, 'The inner card csFile has been deleted');

    card = await service.get(card);
    expect(card.csFiles).to.deep.equal({});
  });

  it('can delete a card', async function() {
    let card = await service.create(
      filesRealm,
      cardDocument().withAttributes({
        csDescription: 'my card',
        csFiles: { inner: { 'example.hbs': 'Hello World' } },
      }).jsonapi
    );

    let name = serializedCardName(card);
    await service.delete(card);

    expect(existsSync(join(filesPath, name))).to.equal(false, 'The card folder doesnt exist');
  });
});

function serializedCardName(card: AddressableCard): string {
  let parts: string[] = [];
  if (card.csOriginalRealm !== card.csRealm) {
    parts.push(card.csOriginalRealm);
  }
  parts.push(card.csId);
  return parts.join('_');
}
