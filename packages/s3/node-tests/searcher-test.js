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
        config: {
          bucket: 'testbucket',
          region: 'testregion'
        }
      }
    });

    factory.addResource('data-sources').withAttributes({
      sourceType: '@cardstack/files',
      params: {
        storeFilesIn: { type: 'data-sources', id: 's3' }
      }
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

  it("Finds a file in S3", async function() {
    await env.setUser('test-users', 'the-default-test-user');

    let response = await request
      .get('/api/cardstack-files/1234.txt')
      .set('Accept', 'text/plain');


    expect(response.status).to.equal(200);
    expect(response.text).to.equal("Here is the body");
    expect(response.header['content-type']).to.equal("text/plain");
    expect(uploadStub.callCount).to.equal(2);

    expect(s3Options.Key).to.equal('1234.txt');
  });
});
