
import Koa from 'koa';
import { wireItUp } from '../main';
import supertest from 'supertest';

describe("hub/jsonapi", function() {
  let request: supertest.SuperTest<supertest.Test>;

  beforeEach(async function() {
    let app = new Koa();
    let container = await wireItUp();
    let jsonapi = await container.lookup('jsonapi-middleware');
    app.use(jsonapi.middleware());
    request = supertest(app.callback());
  });

  it("can create card", async function() {
    let response = await request.post('/api/cards');
    expect(response.status).to.equal(200);
  });
});
