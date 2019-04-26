const {
  createDefaultEnvironment,
  destroyDefaultEnvironment
} = require('@cardstack/test-support/env');
const JSONAPIFactory  = require('@cardstack/test-support/jsonapi-factory');
const supertest       = require('supertest');
const Koa             = require('koa');
const AWS             = require('aws-sdk');
const sinon           = require('sinon');

const { join, extname } = require('path');

const { createReadStream, readFileSync} = require('fs');


describe('cardstack/s3/writer', function() {
  let env, request, s3Options, uploadStub;

  let fixtureJpg = join(__dirname, 'fixtures/small.jpg');

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


    uploadStub = sinon.stub(AWS.S3.prototype, 'upload').callsFake(options => {
      s3Options = options;
      return {
        promise() { return Promise.resolve(); }
      };
    });

    getStub = AWS.S3.prototype.getObject =  sinon.stub().callsFake(options => {
      let Body = createReadStream(fixtureJpg);
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

    let response = await request.post('/api/cardstack-files')
      .attach('avatar', fixtureJpg);


    expect(response.status).to.equal(201);
    expect(uploadStub.callCount).to.equal(1);

    expect(s3Options.Key).to.be.ok;
    expect(s3Options.Body.read).to.be.ok;
    expect(s3Options.Metadata['sha-sum']).to.be.ok;


    let { id } = response.body.data;

    expect(extname(id)).to.equal('.jpeg');

    let response2 = await request
      .get(`/api/cardstack-files/${id}`)
      .set('Accept', 'image/*');

    let data = readFileSync(fixtureJpg);

    expect(response2.status).to.equal(200);
    expect(response2.header['content-type']).to.equal("image/jpeg");
    expect(response2.body.join()).to.equal(data.join());
    expect(getStub.callCount).to.equal(1);

  });
});
