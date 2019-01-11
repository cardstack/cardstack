const {
  createDefaultEnvironment,
  destroyDefaultEnvironment
} = require('@cardstack/test-support/env');
const JSONAPIFactory  = require('@cardstack/test-support/jsonapi-factory');
const supertest       = require('supertest');
const Koa             = require('koa');
const sinon           = require('sinon');
const SftpClient = require('ssh2-sftp-client');


describe('cardstack/sftp/searcher', function() {
  let env, request, listPath, uploadStub, connectStub, connectParams, getStub;

  beforeEach(async function() {
    this.timeout(10000);
    let factory = new JSONAPIFactory();


    factory.addResource('data-sources', 'sftp')
      .withAttributes({
        'source-type': '@cardstack/sftp',
        params: {
          contentType: 'sftp-files',
          branches: {
            master: {
              host: '1.2.3.4',
              port: 22,
              username: 'someuser',
              privateKey: "a private key string"
            }
          }
        }
      });


    env = await createDefaultEnvironment(`${__dirname}/..`, factory.getModels());

    await env.lookup('hub:indexers').update({ forceRefresh: true });

    let app = new Koa();
    app.use(env.lookup('hub:middleware-stack').middleware());
    request = supertest(app.callback());


    listStub = SftpClient.prototype.list = sinon.stub().callsFake(path => {
      listPath = path;

      return [{name: '5678.txt'}];
    });

    connectStub = SftpClient.prototype.connect = sinon.stub().callsFake(params => {
      connectParams = params;
    });

    getStub = SftpClient.prototype.get = sinon.stub().callsFake(path => {
      getPath = path;
      return "Here is the body"
    });
  });

  afterEach(async function() {
    sinon.restore();
    await destroyDefaultEnvironment(env);
  });

  it("Finds a file in SFTP", async function() {
    await env.setUser('test-users', 'the-default-test-user');

    let response = await request
      .get('/api/sftp-files/1234%2f5678.txt')
      .set('Accept', 'text/plain');


    expect(response.status).to.equal(200);
    expect(response.text).to.equal("Here is the body");
    expect(response.header['content-type']).to.equal("text/plain");
    expect(connectStub.callCount).to.equal(2);
    expect(listStub.callCount).to.equal(1);
    expect(getStub.callCount).to.equal(1);

    expect(listPath).to.equal('1234');
    expect(getPath).to.equal('1234/5678.txt');
    expect(connectParams.username).to.equal('someuser');
  });
});
