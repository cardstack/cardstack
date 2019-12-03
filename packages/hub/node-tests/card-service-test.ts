import { queryToSQL, param } from "../pgsearch/util";
import { createTestEnv, TestEnv } from "./helpers";
import { Session } from "../session";
import { myOrigin } from "../origin";

describe("hub/card-service", function() {
  let env: TestEnv;

  beforeEach(async function() {
    env = await createTestEnv();
  });

  afterEach(async function() {
    await env.destroy();
  });

  it("saves a card", async function() {
    let doc = {
      data: {
        type: "cards",
        relationships: {
          "adopted-from": {
            data: { type: "cards", id: "core-catalog::@cardstack/base-card" }
          }
        },
        attributes: {
          model: {
            attributes: {
              "new-field-0": "hello"
            }
          },
          "field-order": ["new-field-0"],
          fields: {
            "new-field-0": {
              attributes: {
                caption: "your new field"
              },
              relationships: {
                definition: {
                  data: {
                    type: "cards",
                    id: "core-catalog::@cardstack/string"
                  }
                }
              }
            }
          }
        }
      }
    };

    let service = await env.container.lookup('cards');
    let card = await service.create(Session.EVERYONE, new URL(`${myOrigin}/api/realms/first-ephemeral-realm`), doc);
    expect(card.realm.href).to.equal(`${myOrigin}/api/realms/first-ephemeral-realm`);

    let pgclient = await env.container.lookup('pgclient');
    let result = await pgclient.query(
      queryToSQL([`select * from cards where realm = `, param(`${myOrigin}/api/realms/first-ephemeral-realm`)])
    );
    expect(result.rowCount).equals(1);
  });
});
