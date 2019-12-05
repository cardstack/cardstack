import { param } from "../pgsearch/util";
import { createTestEnv, TestEnv } from "./helpers";
import { Session } from "../session";
import { myOrigin } from "../origin";
import { testCard } from "./test-card";
import CardsService from "../cards-service";

describe("hub/card-service", function() {
  describe("read-write", function() {
    let env: TestEnv;

    beforeEach(async function() {
      env = await createTestEnv();
    });

    afterEach(async function() {
      await env.destroy();
    });

    it("handles get from missing realm", async function() {
      let service = await env.container.lookup("cards");
      try {
        await service.get(Session.EVERYONE, {
          realm: new URL("http://not-a-known-realm"),
          localId: "x"
        });
        throw new Error(`should not get here`);
      } catch (err) {
        expect(err.message).to.match(/no such realm/);
      }
    });

    it("saves a card", async function() {
      let doc = testCard({ hello: "world" });
      let service = await env.container.lookup("cards");
      let card = await service.create(
        Session.EVERYONE,
        new URL(`${myOrigin}/api/realms/first-ephemeral-realm`),
        doc.jsonapi
      );
      expect(card.realm.href).to.equal(
        `${myOrigin}/api/realms/first-ephemeral-realm`
      );

      let pgclient = await env.container.lookup("pgclient");
      let result = await pgclient.query(
        service.getScopedCardService(Session.EVERYONE),
        [
          `select * from cards where realm = `,
          param(`${myOrigin}/api/realms/first-ephemeral-realm`)
        ]
      );
      expect(result.rowCount).equals(1);
    });

    it("can get a card back out", async function() {
      let doc = testCard({ hello: "world" });
      let service = await env.container.lookup("cards");
      let card = await service.create(
        Session.EVERYONE,
        new URL(`${myOrigin}/api/realms/first-ephemeral-realm`),
        doc.jsonapi
      );
      let foundCard = await service.get(Session.EVERYONE, card);
      expect(foundCard.id).equals(card.id);
    });
  });

  describe("readonly", function() {
    let env: TestEnv;
    let service: CardsService;

    before(async function() {
      env = await createTestEnv();
      service = await env.container.lookup("cards");
      await service.create(
        Session.INTERNAL_PRIVILEGED,
        new URL(`${myOrigin}/api/realms/first-ephemeral-realm`),
        testCard({ localId: "1" }, {}).jsonapi
      );
      await service.create(
        Session.INTERNAL_PRIVILEGED,
        new URL(`${myOrigin}/api/realms/first-ephemeral-realm`),
        testCard({ localId: "2" }, {}).jsonapi
      );
      await service.create(
        Session.INTERNAL_PRIVILEGED,
        new URL(`${myOrigin}/api/realms/first-ephemeral-realm`),
        testCard(
          {
            localId: "1",
            originalRealm: `http://example.com/api/realms/second-ephemeral-realm`
          },
          {}
        ).jsonapi
      );
      await service.create(
        Session.INTERNAL_PRIVILEGED,
        new URL(`${myOrigin}/api/realms/first-ephemeral-realm`),
        testCard(
          {
            localId: "2",
            originalRealm: `http://example.com/api/realms/second-ephemeral-realm`
          },
          {}
        ).jsonapi
      );
      await service.create(
        Session.INTERNAL_PRIVILEGED,
        new URL(`http://example.com/api/realms/second-ephemeral-realm`),
        testCard({ localId: "1" }, {}).jsonapi
      );
      await service.create(
        Session.INTERNAL_PRIVILEGED,
        new URL(`http://example.com/api/realms/second-ephemeral-realm`),
        testCard({ localId: "2" }, {}).jsonapi
      );
      await service.create(
        Session.INTERNAL_PRIVILEGED,
        new URL(`http://example.com/api/realms/second-ephemeral-realm`),
        testCard(
          {
            localId: "1",
            originalRealm: `${myOrigin}/api/realms/first-ephemeral-realm`
          },
          {}
        ).jsonapi
      );
      await service.create(
        Session.INTERNAL_PRIVILEGED,
        new URL(`http://example.com/api/realms/second-ephemeral-realm`),
        testCard(
          {
            localId: "2",
            originalRealm: `${myOrigin}/api/realms/first-ephemeral-realm`
          },
          {}
        ).jsonapi
      );
    });

    after(async function() {
      await env.destroy();
    });

    it("can filter by realm", async function() {
      let { cards } = await service.search(Session.EVERYONE, {
        filter: {
          eq: { realm: `${myOrigin}/api/realms/first-ephemeral-realm` },
        }
      });
      expect(cards.length).equals(4);
    });
  });
});
