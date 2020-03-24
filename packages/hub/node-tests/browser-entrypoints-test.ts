import { AddressableCard } from '../card';
import { ScopedCardService } from '../cards-service';
import { myOrigin } from '../origin';
import { Session } from '../session';
import { createTestEnv, TestEnv } from './helpers';
import { cardDocument } from '../card-document';

const realm = `${myOrigin}/api/realms/first-ephemeral-realm`;

describe('hub/browser-entrypoints', function() {
  describe('read-only', function() {
    let env: TestEnv;
    let service: ScopedCardService;
    let alpha: AddressableCard;

    before(async function() {
      env = await createTestEnv();
      service = await (await env.container.lookup('cards')).as(Session.EVERYONE);
      alpha = await service.create(
        realm,
        cardDocument()
          .withAttributes({
            csFeatures: { 'isolated-layout': 'isolated.hbs' },
            csFiles: { 'isolated.hbs': `<h1>{{@name}}</h1>` },
          })
          .withField('name', 'string-field').jsonapi
      );
    });

    after(async function() {
      await env.destroy();
    });

    it('smoke test', async function() {
      let entries = await alpha.browserEntrypoints();
      expect(entries.entrypoints.has('isolated')).equals(true, 'contains isolated entrypoint');
      let hash = entries.entrypoints.get('isolated')!;
      expect(entries.code.has(hash)).equals(true, 'corresponding code chunk exists');
      expect(entries.code.get(hash)).matches(/<h1>/, 'own template appears');
    });

    it('replaces field names with their implementations', async function() {
      let entries = await alpha.browserEntrypoints();
      let hash = entries.entrypoints.get('isolated')!;
      let code = entries.code.get(hash)!;
      let importPattern = /import (.*) from "https:\/\/base\.cardstack\.com\/public\/cards\/string-field\/embedded-layout"/;
      expect(code).matches(importPattern);
      let localVar = importPattern.exec(code)![1];
    });
  });
});
