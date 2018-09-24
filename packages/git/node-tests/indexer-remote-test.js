const temp = require('@cardstack/test-support/temp-helper');
const JSONAPIFactory = require('@cardstack/test-support/jsonapi-factory');
const {
  createDefaultEnvironment,
  destroyDefaultEnvironment
} = require('@cardstack/test-support/env');
const { join } = require('path');

function toResource(doc) {
  return doc.data;
}

describe('git/indexer with remote', function() {
  let root, env, indexer, searcher, dataSource, start, client;

  this.timeout(10000);

  beforeEach(async function() {
    root = await temp.mkdir('cardstack-server-test-remote');

    let factory = new JSONAPIFactory();

    factory.addResource('content-types', 'events')
      .withRelated('fields', [
        factory.addResource('fields', 'title')
          .withAttributes({
            fieldType: '@cardstack/core-types::string'
          }),
        factory.addResource('fields', 'published-date')
          .withAttributes({
            fieldType: '@cardstack/core-types::string'
          })
      ]);

    dataSource = factory.addResource('data-sources')
        .withAttributes({
          'source-type': '@cardstack/git',
          params: {
            repo: root,
            remote: {
              url: 'https://github.com/mansona/data-test.git'
            }
          }
        });

    factory.addResource('plugin-configs', '@cardstack/hub')
      .withRelated(
        'default-data-source',
        dataSource
      );

    start = async function() {
      env = await createDefaultEnvironment(join(__dirname, '..'), factory.getModels());
      indexer = env.lookup('hub:indexers');
      searcher = env.lookup('hub:searchers');
      client = env.lookup(`plugin-client:${require.resolve('@cardstack/pgsearch/client')}`);
    };
  });

  afterEach(async function() {
    await temp.cleanup();
    await destroyDefaultEnvironment(env);
  });

  it('clones the remote when local repo does not exist', async function() {
    await start();
    let indexerState = await client.loadMeta({ branch: 'master', id: dataSource.id });
    expect(indexerState.commit).to.equal('e2c073f7a4f97662990df39c51fa942ee22f4542');
  });

  it('indexes existing data in the remote after it is cloned', async function() {
    await start();
    await indexer.update();

    let indexerState = await client.loadMeta({ branch: 'master', id: dataSource.id });
    expect(indexerState.commit).to.equal('e2c073f7a4f97662990df39c51fa942ee22f4542');

    let contents = await searcher.get(env.session, 'master', 'events', 'event-1');
    let jsonapi = toResource(contents);
    expect(jsonapi).has.deep.property('attributes.title', 'This is a test event');
  });
});

describe('git/indexer with remote and credentials', function() {
  let root, env, indexer, searcher, dataSource, start, client;

  this.timeout(10000);

  beforeEach(async function() {
    root = await temp.mkdir('cardstack-server-test-remote-with-creds');

    let factory = new JSONAPIFactory();

    factory.addResource('content-types', 'events')
      .withRelated('fields', [
        factory.addResource('fields', 'title')
          .withAttributes({
            fieldType: '@cardstack/core-types::string'
          }),
        factory.addResource('fields', 'published-date')
          .withAttributes({
            fieldType: '@cardstack/core-types::string'
          })
      ]);

    dataSource = factory.addResource('data-sources')
        .withAttributes({
          'source-type': '@cardstack/git',
          params: {
            repo: root,
            remote: {
              url: 'git@github.com:mansona/data-test.git',
              privateKey: `-----BEGIN RSA PRIVATE KEY-----
MIIEowIBAAKCAQEApC/aj0dmS0AuqvB+XdZh7MqcaE8OnFhFhC2OCpd8Id5zcXGa
IYSe4SFI1wCA2OKhPYK9+6G01WidRafrzgiqQWMLuWemA2tDpngQyygiThI5v/pe
MIUvGmreMyp47tcgIO2ohe0zeoae5Lhh/CYjlyToIgNCI304/fAnhTUs8XRDiljv
kdQgAFqDUBm+HGpkNwO8XOJkdtWb7mNphHHsMM+sV1WfIsTtNJGi7SKX6azHIT1G
IOI2TsEAUQ5606fFiqpSBjpotceKXQX3LdFfcgMkzcfA9arBY7Ct/lSyRUWTYKrt
/QgmJkLkb3LUzKFmBBF39ZPNJYCGlHurm3pnBQIDAQABAoIBAAGF8CEkKG7KSaSM
Vp/IPWBVAN523UvWBc8UHR08CorF5YxH4YYuFMtB48sa1hctAxHvBJQxC9xu/AaJ
aEahDfNNV+6AZ6ngdOA2fPFljevrf12olPceRTGZjDYtTrHojQPBMK8NZEzestqs
Wzxbnjjovr6SCSsLHlw8viEePSyAQ9JLPdJMs4up0mYS/LJuNXCgbfK2bUX30uY0
ALlGH0bSZSgxMnmSaLf7IvYMaEmChjQesPz/eZG4QieJXfKOW5Faj5otaeydH8CN
+v7b6NO/I1pMzGTHizAgXztoI/yvhgCpsUwY5A+/cFIAY3JHGqH+kZ2syv7h3A47
0oqivAECgYEAzlflZPmmtDnEc88+OC05Nxh08e0mNEdCh+2yRpeJXlTGdQ6u0Jr+
x3V34Ayu3MafGIYX74O+Q+XCr6pcwEDsa3vwNFUbi1EXK7kdZQJD1Ax+XQVMcsKn
uDH6gtv0NGZun+/xHm+jrvNgIpe5k/K1m+QENf0QwRlmkD4AqNzFbHkCgYEAy7LY
i6E4bv2W4GOkdi3397cIp23knX5FPUEne6aoUoPAzcX55PGB0IeVJ24xEDly2vdm
jlLXE5dhvIblUIATuH6sPWGI7WG4ovxxLnLAM/ZgG2Ndiiqd/zpRYs5uOHhPFQvN
MirJc4+6TrW9skFEq1jPGyGaV/k3CoJSQ2ToE+0CgYAS+3kJ8gGJAOt2r/EMX/Ss
gd54RxXFp2ySbqaA4f3sJKZhLGmenTOlC8RsYx5PByKpseRPz3HYczGW0XhY42Ac
fzlYxx+SkHIuPohau3ub7U5OpmcjA49EXayrDysHCwlQQ1WONDz9ojwM0qJq3uAg
KDjO8qnw6bJKwLl0z2KGGQKBgBTP6SAbENEGR+wVQjBw8ez1XoT8zWbqB9kCVy5j
EL+dho1/tNCXfFP6BltI/upRdFK7BFd2T1NJHEtO3Q8kht9K0f5TgNIAMgU1FbtR
LiIhAiDKPjxnrkztgHM/9DMA19OmqQh/JqYQAVEZcJBN6t427LIw9LwYUm9YcV9B
aBThAoGBAJIWm/x7sjL0xICWgSgwNFQTSx0uHzK+uDi6z5joT1sil+yk6yyhlvT2
EyTnuOvN0a7ilbhprm0Ri4Zy5Lg7KQxT3Hm/O+CXFlZNM4EgVe9hGtSDHpNJpGCh
c3JFZC7/Jm0vPd04PmXqRgyYya9zKXmfG/D1I0db/ZGEtxNFPTJU
-----END RSA PRIVATE KEY-----`,
            },
            remoteUsername: 'mansona',
          }
        });

    factory.addResource('plugin-configs', '@cardstack/hub')
      .withRelated(
        'default-data-source',
        dataSource
      );

    start = async function() {
      env = await createDefaultEnvironment(join(__dirname, '..'), factory.getModels());
      indexer = env.lookup('hub:indexers');
      searcher = env.lookup('hub:searchers');
      client = env.lookup(`plugin-client:${require.resolve('@cardstack/pgsearch/client')}`);
    };
  });

  afterEach(async function() {
    await temp.cleanup();
    await destroyDefaultEnvironment(env);
  });

  it('clones the remote when local repo does not exist', async function() {
    await start();
    let indexerState = await client.loadMeta({ branch: 'master', id: dataSource.id });
    expect(indexerState.commit).to.equal('e2c073f7a4f97662990df39c51fa942ee22f4542');
  });

  it('indexes existing data in the remote after it is cloned', async function() {
    await start();
    await indexer.update();

    let indexerState = await client.loadMeta({ branch: 'master', id: dataSource.id });
    expect(indexerState.commit).to.equal('e2c073f7a4f97662990df39c51fa942ee22f4542');

    let contents = await searcher.get(env.session, 'master', 'events', 'event-1');
    let jsonapi = toResource(contents);
    expect(jsonapi).has.deep.property('attributes.title', 'This is a test event');
  });
});
