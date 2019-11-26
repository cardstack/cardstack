import Koa from "koa";
import { wireItUp } from "../main";
import supertest from "supertest";
import { myOrigin } from "../origin";

describe("hub/jsonapi", function() {
  let request: supertest.SuperTest<supertest.Test>;

  beforeEach(async function() {
    let app = new Koa();
    let container = await wireItUp();
    let jsonapi = await container.lookup("jsonapi-middleware");
    app.use(jsonapi.middleware());
    request = supertest(app.callback());
  });

  it("errors correctly for missing post body", async function() {
    let response = await request
      .post("/api/realms/first-ephemeral-realm/cards")
      .set("Content-Type", "application/vnd.api+json");
    expect(response.status).to.equal(400);
    expect(response.body.errors).has.length(1);
    expect(response.body.errors[0]).property('detail', 'missing resource object');
    expect(response.body.errors[0].source).property('pointer', '/data');

  });

  it("errors correctly for invalid json", async function() {
    let response = await request
      .post("/api/realms/first-ephemeral-realm/cards")
      .set("Content-Type", "application/vnd.api+json")
      .send("{ data ");
    expect(response.status).to.equal(400);
    expect(response.body.errors).has.length(1);
    expect(response.body.errors[0]).property('detail', 'error while parsing body: Unexpected token d in JSON at position 2');
  });

  it("errors correctly for local realm on remote-realms endpoint", async function() {
    let response = await request
      .post(`/api/remote-realms/${encodeURIComponent(myOrigin + '/api/realms/first-ephemeral-realm')}/cards`)
      .set("Content-Type", "application/vnd.api+json")
      .send({ data: {
        type: 'cards'
      } });
    expect(response.status).to.equal(400);
    expect(response.body.errors).has.length(1);
    expect(response.body.errors[0].detail).matches(/is a local realm. You tried to access it/);
  });

  it("can create card", async function() {
    let response = await request
      .post("/api/realms/first-ephemeral-realm/cards")
      .set("Content-Type", "application/vnd.api+json")
      .send({
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
                "new-field-0": "hello",
              }
            },
            "field-order": ["new-field-0"],
            fields: {
              "new-field-0": {
                attributes: {
                  caption: "Your New Field"
                },
                relationships: {
                  definition: {
                    data: {
                      type: "cards",
                      id: "core-catalog::@cardstack/string"
                    }
                  }
                }
              },
            }
          }
        }
      });
    expect(response.status).to.equal(201);
    expect(response.header.location).to.match(/http:\/\/[^/]+\/api\/realms\/first-ephemeral-realm\/cards\/[^/]+/);
  });
});
