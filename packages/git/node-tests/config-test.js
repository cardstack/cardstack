const { inRepo, commitOpts } = require('./support');
const temp = require('@cardstack/test-support/temp-helper');
const {
  createDefaultEnvironment,
  destroyDefaultEnvironment
} = require('@cardstack/test-support/env');
const JSONAPIFactory = require('@cardstack/test-support/jsonapi-factory');
const { makeRepo } = require('./support');
const Change = require('../change');

describe('git/config', function() {

  let factory, env, repoPath;

  beforeEach(async function() {
    factory = new JSONAPIFactory();

    env = null;
    repoPath = await temp.mkdir('cardstack-server-test');
  });

  afterEach(async function() {
    if (env) {
      await destroyDefaultEnvironment(env);
    }
    await temp.cleanup();
  });


  it('respects basePath when writing', async function () {
    await makeRepo(repoPath);

    let source = factory.addResource('data-sources')
      .withAttributes({
        'source-type': '@cardstack/git',
        params: { repo: repoPath, basePath: 'my/base' }
      });

    factory.addResource('content-types', 'articles')
      .withRelated('fields', [
        factory.addResource('fields', 'title').withAttributes({ fieldType: '@cardstack/core-types::string' }),
      ]).withRelated('data-source', source);

    factory.addResource('articles', 1)
      .withAttributes({
        title: 'First Article'
      });

    env = await createDefaultEnvironment(`${__dirname}/..`, factory.getModels());
    let contents = await inRepo(repoPath).getJSONContents('master', `my/base/contents/articles/1.json`);
    expect(contents).deep.equals({
      attributes: {
        title: 'First Article'
      }
    });
  });

  it('respects basePath when indexing', async function() {
    let change = await Change.createInitial(repoPath, 'master');

    (await change.get('contents/articles/1.json', { allowCreate: true }))
      .setContent(JSON.stringify({
        attributes: {
          title: 'ignored'
        }
      }));

    (await change.get('my/base/contents/articles/2.json', { allowCreate: true }))
      .setContent(JSON.stringify({
        attributes: {
          title: 'hello'
        }
      }));

    await change.finalize(commitOpts());

    let source = factory.addResource('data-sources')
      .withAttributes({
        'source-type': '@cardstack/git',
        params: { repo: repoPath, basePath: 'my/base' }
      });

    factory.addResource('content-types', 'articles')
      .withRelated('fields', [
        factory.addResource('fields', 'title').withAttributes({ fieldType: '@cardstack/core-types::string' }),
      ]).withRelated('data-source', source);


    env = await createDefaultEnvironment(`${__dirname}/..`, factory.getModels());

    let response = await env.lookup('hub:searchers').search('master', { filter: { type: 'articles' } });
    expect(response.data.map(m => m.id)).deep.equals(['2']);
  });

  it('respects branchPrefix when creating', async function () {
    let change = await Change.createInitial(repoPath, 'cs-master');
    await change.finalize(commitOpts());

    let source = factory.addResource('data-sources')
      .withAttributes({
        'source-type': '@cardstack/git',
        params: { repo: repoPath, branchPrefix: 'cs-' }
      });

    factory.addResource('content-types', 'articles')
      .withRelated('fields', [
        factory.addResource('fields', 'title').withAttributes({ fieldType: '@cardstack/core-types::string' }),
      ]).withRelated('data-source', source);

    factory.addResource('articles', 1)
      .withAttributes({
        title: 'First Article'
      });

    env = await createDefaultEnvironment(`${__dirname}/..`, factory.getModels());
    let contents = await inRepo(repoPath).getJSONContents('cs-master', `contents/articles/1.json`);
    expect(contents).deep.equals({
      attributes: {
        title: 'First Article'
      }
    });
  });

  it('respects branchPrefix when indexing', async function() {
    let change = await Change.createInitial(repoPath, 'master');
    let repo = change.repo;

    (await change.get('contents/articles/1.json', { allowCreate: true }))
      .setContent(JSON.stringify({
        attributes: {
          title: 'hello'
        }
      }));

    let head = await change.finalize(commitOpts());

    change = await Change.createBranch(repo, head, 'cs-master');
    (await change.get('contents/articles/1.json', {})).delete();
    (await change.get('contents/articles/2.json', { allowCreate: true }))
      .setContent(JSON.stringify({
        attributes: {
          title: 'second'
        }
      }));
    await change.finalize(commitOpts());

    let source = factory.addResource('data-sources')
      .withAttributes({
        'source-type': '@cardstack/git',
        params: { repo: repoPath, branchPrefix: 'cs-' }
      });

    factory.addResource('content-types', 'articles')
      .withRelated('fields', [
        factory.addResource('fields', 'title').withAttributes({ fieldType: '@cardstack/core-types::string' }),
      ]).withRelated('data-source', source);


    env = await createDefaultEnvironment(`${__dirname}/..`, factory.getModels());

    let response = await env.lookup('hub:searchers').search('master', { filter: { type: 'articles' } });
    expect(response.data.map(m => m.id)).deep.equals(['2']);
  });


});
