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

  it("can create card", async function() {
    let response = await request
      .post("/api/cards")
      .set("Content-Type", "application/vnd.api+json")
      .send({
        data: {
          id: "local-hub::new-card-476650",
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
  });
});
