import { CardWithId } from "../card";
import { queryToSQL, param } from "../pgsearch/util";
import { createTestEnv, TestEnv } from "./helpers";
import { testCard } from "./test-card";

describe("hub/pgclient", function() {
  let env: TestEnv;

  beforeEach(async function() {
    env = await createTestEnv();
  });

  afterEach(async function() {
    await env.destroy();
  });

  it("it can access the database", async function() {
    let pgclient = await env.container.lookup("pgclient");
    let result = await pgclient.query("select 1");
    expect(result.rowCount).equals(1);
  });

  it("saves a card", async function() {
    let card = new CardWithId(testCard({ localId: 'card-1', realm: `http://hassan.com/realm` }, { hello: 'world' }).jsonapi);
    let pgclient = await env.container.lookup("pgclient");
    let batch = pgclient.beginBatch();
    await batch.save(card);
    await batch.done();

    let result = await pgclient.query(
      queryToSQL([`select * from cards where local_id = `, param("card-1")])
    );
    expect(result.rowCount).equals(1);
  });
});
