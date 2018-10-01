const {
  createDefaultEnvironment,
  destroyDefaultEnvironment
} = require('@cardstack/test-support/env');
const JSONAPIFactory  = require('@cardstack/test-support/jsonapi-factory');
const supertest       = require('supertest');
const Koa             = require('koa');
const AWS             = require('aws-sdk');
const sinon           = require('sinon');
const { join }        = require('path');


describe('cardstack/s3/writer', function() {
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

    env = await createDefaultEnvironment(`${__dirname}/..`, factory.getModels());

    await env.lookup('hub:indexers').update({ forceRefresh: true });

    let app = new Koa();
    app.use(env.lookup('hub:middleware-stack').middleware());
    request = supertest(app.callback());


    uploadStub = sinon.stub(AWS.S3.prototype, 'upload').callsFake(options => {
      s3Options = options;
      return {
        promise() { return Promise.resolve(); }
      };
    });
  });

  afterEach(async function() {
    sinon.restore();
    await destroyDefaultEnvironment(env);
  });

  it("Creates a file in S3", async function() {
    await env.setUser('test-users', 'the-default-test-user');

    let response = await request.post('/api/cs-files')
      .attach('avatar', join(__dirname, 'fixtures/small.jpg'));


    expect(response.status).to.equal(201);
    expect(uploadStub.callCount).to.equal(1);

    expect(s3Options.Key).to.be.ok;
    expect(s3Options.Body.read).to.be.ok;
    expect(s3Options.Metadata['sha-sum']).to.be.ok;
  });
});
