import { wireItUp } from "../main";
import { Container } from "../dependency-injection";
import PgClient from "../pgsearch/pgclient";
import { CardWithId } from "../card";
import { queryToSQL, param } from "../pgsearch/util";

describe("hub/pgclient", function() {
  let container: Container;

  before(function() {
    process.env.PGDATABASE = `test_db_${Math.floor(100000 * Math.random())}`;
  });

  beforeEach(async function() {
    container = await wireItUp();
  });

  afterEach(async function() {
    await container.teardown();
    await PgClient.deleteSearchIndexIHopeYouKnowWhatYouAreDoing();
  });

  it("it can access the database", async function() {
    let pgclient = await container.lookup("pgclient");
    let result = await pgclient.query("select 1");
    expect(result.rowCount).equals(1);
  });

  it("saves a card", async function() {
    let card = new CardWithId({
      data: {
        type: "cards",
        relationships: {
          "adopted-from": {
            data: { type: "cards", id: "core-catalog::@cardstack/base-card" }
          }
        },
        attributes: {
          "local-id": "card-1",
          realm: "http://hassan.com/my-realm",
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
    });
    let pgclient = await container.lookup("pgclient");
    let batch = pgclient.beginBatch();
    await batch.save(card);
    await batch.done();

    let result = await pgclient.query(
      queryToSQL([`select * from cards where local_id = `, param("card-1")])
    );
    expect(result.rowCount).equals(1);
  });
});
