const {
  createDefaultEnvironment,
  destroyDefaultEnvironment
} = require('@cardstack/test-support/env');
const JSONAPIFactory  = require('@cardstack/test-support/jsonapi-factory');
const supertest       = require('supertest');
const Koa             = require('koa');
const AWS             = require('aws-sdk');
const sinon           = require('sinon');

describe('cardstack/s3/searcher', function() {
  let env, request, s3Options, uploadStub;

  beforeEach(async function() {
    this.timeout(10000);
    let factory = new JSONAPIFactory();

    factory.addResource('data-sources', 's3').withAttributes({
      'source-type': '@cardstack/s3',
      params: {
        branches: {
          master: {
            bucket: 'testbucket',
            region: 'testregion'
          }
        }
      }
    });

    factory.addResource('cs-files', '1234').withAttributes({
      'sha-sum': 'sum',
      'content-type': 'text/plain'
    });

    env = await createDefaultEnvironment(`${__dirname}/..`, factory.getModels());

    await env.lookup('hub:indexers').update({ forceRefresh: true });

    let app = new Koa();
    app.use(env.lookup('hub:middleware-stack').middleware());
    request = supertest(app.callback());


    uploadStub = AWS.S3.prototype.getObject =  sinon.stub().callsFake(options => {
      s3Options = options;
      let Body = "Here is the body";
      return {
        promise() { return Promise.resolve({ Body }); }
      };
    });
  });

  afterEach(async function() {
    sinon.restore();
    await destroyDefaultEnvironment(env);
  });

  it("Creates a file in S3", async function() {
    await env.setUser('test-users', 'the-default-test-user');

    let response = await request.get('/api/cs-files/1234');

    expect(response.status).to.equal(200);
    expect(response.text).to.equal("Here is the body");
    expect(response.header['content-type']).to.equal("text/plain");
    expect(uploadStub.callCount).to.equal(1);

    expect(s3Options.Key).to.equal('1234');
  });
});
