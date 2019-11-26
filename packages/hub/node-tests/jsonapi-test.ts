import Koa from "koa";
import { wireItUp } from "../main";
import supertest from "supertest";

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
      .post("/api/realms/some-realm")
      .set("Content-Type", "application/vnd.api+json");
    expect(response.status).to.equal(400);
    expect(response.body.errors).has.length(1);
    expect(response.body.errors[0]).property('detail', 'A JSON:API formatted body is required');
  });

  it("errors correctly for invalid json", async function() {
    let response = await request
      .post("/api/cards")
      .set("Content-Type", "application/vnd.api+json")
      .send("{ data ");
    expect(response.status).to.equal(400);
    expect(response.body.errors).has.length(1);
    expect(response.body.errors[0]).property('detail', 'error while parsing body: Unexpected token d in JSON at position 2');
  });

  it("can create card", async function() {
    let response = await request
      .post("/api/realms/my-realm")
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
    expect(response.header.location).to.match(/http:\/\/[^/]+\/api\/cards\/my-realm\/[^/]+/);
  });
});
