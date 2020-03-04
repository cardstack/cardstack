// const { createDefaultEnvironment, destroyDefaultEnvironment } = require('@cardstack/test-support/env'); // eslint-disable-line @typescript-eslint/no-var-requires, @typescript-eslint/no-require-imports

// // eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/no-require-imports
// const JSONAPIFactory = require('@cardstack/test-support/jsonapi-factory');

// // eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/no-require-imports
// const temp = require('@cardstack/test-support/temp-helper');
// const { mkdir } = temp;

// import { join } from 'path';
// import { writeFileSync, readdirSync, mkdirSync } from 'fs';

// import { promisify } from 'util';
// import sinon from 'sinon';

// import filenamifyUrl from 'filenamify-url';
// import rimrafcb from 'rimraf';
// const rimraf = promisify(rimrafcb);

// import service from '../service';

// describe('local git cache service', function() {
//   let tempRepoPath: string;

//   this.timeout(10000);

//   beforeEach(function() {
//     service.clearCache();
//   });

//   afterEach(async function() {
//     service.clearCache();
//     await temp.cleanup();
//   });

//   it('creates a local clone of the repo with a naming convention', async function() {
//     tempRepoPath = (await mkdir('test-1')) as string;

//     let factory = new JSONAPIFactory();

//     let dataSource1 = factory.addResource('data-sources').withAttributes({
//       'source-type': '@cardstack/git',
//       params: {
//         remote: {
//           url: 'http://root:password@localhost:8838/git/repo',
//           cacheDir: tempRepoPath,
//         },
//       },
//     });

//     factory.addResource('plugin-configs', '@cardstack/hub').withRelated('default-data-source-test-1', dataSource1);

//     let env = await createDefaultEnvironment(`${__dirname}/..`, factory.getModels());

//     expect(readdirSync(tempRepoPath)).to.have.length(1);

//     await destroyDefaultEnvironment(env);
//   });

//   it('consideres localhost and 127.0.0.1 different for the purposes of a local cache', async function() {
//     tempRepoPath = (await mkdir('test-2')) as string;

//     let factory = new JSONAPIFactory();

//     let dataSource1 = factory.addResource('data-sources').withAttributes({
//       'source-type': '@cardstack/git',
//       params: {
//         remote: {
//           url: 'http://root:password@localhost:8838/git/repo',
//           cacheDir: tempRepoPath,
//         },
//       },
//     });

//     let dataSource2 = factory.addResource('data-sources').withAttributes({
//       'source-type': '@cardstack/git',
//       params: {
//         remote: {
//           url: 'http://root:password@127.0.0.1:8838/git/repo',
//           cacheDir: tempRepoPath,
//         },
//       },
//     });

//     factory.addResource('plugin-configs', '@cardstack/hub').withRelated('default-data-source', dataSource1);

//     factory.addResource('plugin-configs', '@cardstack/hub').withRelated('second-data-source', dataSource2);

//     let env = await createDefaultEnvironment(`${__dirname}/..`, factory.getModels());

//     expect(readdirSync(tempRepoPath)).to.have.length(2);

//     await destroyDefaultEnvironment(env);
//   });

//   it('only creates one local repo if the remote is the same for the writer and indexer', async function() {
//     let getRepoSpy = sinon.spy(service, 'getRepo');
//     let _makeRepoSpy = sinon.spy(service, '_makeRepo');

//     tempRepoPath = (await mkdir('test-3')) as string;

//     let factory = new JSONAPIFactory();

//     let dataSource1 = factory.addResource('data-sources').withAttributes({
//       'source-type': '@cardstack/git',
//       params: {
//         remote: {
//           url: 'http://root:password@localhost:8838/git/repo',
//           cacheDir: tempRepoPath,
//         },
//       },
//     });

//     factory.addResource('plugin-configs', '@cardstack/hub').withRelated('default-data-source-test-1', dataSource1);

//     let env = await createDefaultEnvironment(`${__dirname}/..`, factory.getModels());

//     sinon.assert.calledTwice(getRepoSpy);
//     sinon.assert.calledOnce(_makeRepoSpy);

//     await destroyDefaultEnvironment(env);
//     getRepoSpy.restore();
//     _makeRepoSpy.restore();
//   });

//   it('allows you to restart the hub and it will re-use the exising cached folder', async function() {
//     this.timeout(20000);

//     let getRepoSpy = sinon.spy(service, 'getRepo');
//     let _makeRepoSpy = sinon.spy(service, '_makeRepo');

//     tempRepoPath = await mkdir('test-4');

//     let factory = new JSONAPIFactory();

//     let dataSource1 = factory.addResource('data-sources').withAttributes({
//       'source-type': '@cardstack/git',
//       params: {
//         remote: {
//           url: 'http://root:password@localhost:8838/git/repo',
//           cacheDir: tempRepoPath,
//         },
//       },
//     });

//     factory.addResource('plugin-configs', '@cardstack/hub').withRelated('default-data-source-test-1', dataSource1);

//     let env = await createDefaultEnvironment(`${__dirname}/..`, factory.getModels());

//     sinon.assert.calledTwice(getRepoSpy);
//     sinon.assert.calledOnce(_makeRepoSpy);

//     await destroyDefaultEnvironment(env);
//     service.clearCache();

//     // create the environment a second time
//     env = await createDefaultEnvironment(`${__dirname}/..`, factory.getModels());

//     sinon.assert.callCount(getRepoSpy, 4);
//     sinon.assert.calledTwice(_makeRepoSpy);

//     await rimraf(tempRepoPath);
//     getRepoSpy.restore();
//     _makeRepoSpy.restore();
//     await destroyDefaultEnvironment(env);
//   });

//   it('will re-clone the remote repo if the local folder exists but is not a valid git repo', async function() {
//     this.timeout(20000);

//     let getRepoSpy = sinon.spy(service, 'getRepo');
//     let _makeRepoSpy = sinon.spy(service, '_makeRepo');

//     let url = 'http://root:password@localhost:8838/git/repo';

//     let tempRepoPath = await mkdir('test-5');

//     let repoPath = join(tempRepoPath, filenamifyUrl(url));
//     mkdirSync(repoPath);
//     mkdirSync(join(repoPath, '.git'));
//     writeFileSync(join(repoPath, '.git', 'index'), 'I really shouldnt be here');

//     let factory = new JSONAPIFactory();

//     let dataSource1 = factory.addResource('data-sources').withAttributes({
//       'source-type': '@cardstack/git',
//       params: {
//         remote: {
//           url,
//           cacheDir: tempRepoPath,
//         },
//       },
//     });

//     factory.addResource('plugin-configs', '@cardstack/hub').withRelated('default-data-source-test-1', dataSource1);

//     let env = await createDefaultEnvironment(`${__dirname}/..`, factory.getModels());

//     sinon.assert.calledTwice(getRepoSpy);
//     sinon.assert.calledOnce(_makeRepoSpy);

//     getRepoSpy.restore();
//     _makeRepoSpy.restore();
//     await destroyDefaultEnvironment(env);
//   });
// });
