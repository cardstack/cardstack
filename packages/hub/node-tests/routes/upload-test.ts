import path from 'path';
import shortUuid from 'short-uuid';
import { registry, setupHub } from '../helpers/server';

const stubNonce = 'abc:123';
let stubAuthToken = 'def--456';
let stubTimestamp = process.hrtime.bigint();

class StubAuthenticationUtils {
  generateNonce() {
    return stubNonce;
  }
  buildAuthToken() {
    return stubAuthToken;
  }
  extractVerifiedTimestamp(_nonce: string) {
    return stubTimestamp;
  }

  validateAuthToken(encryptedAuthToken: string) {
    return handleValidateAuthToken(encryptedAuthToken);
  }
}

class StubWeb3Storage {
  async upload() {
    return 'CID';
  }
}

let stubUserAddress = '0x2f58630CA445Ab1a6DE2Bb9892AA2e1d60876C13';
function handleValidateAuthToken(encryptedString: string) {
  expect(encryptedString).to.equal('abc123--def456--ghi789');
  return stubUserAddress;
}

describe('POST /upload', function () {
  this.beforeEach(function () {
    registry(this).register('authentication-utils', StubAuthenticationUtils);
    registry(this).register('web3-storage', StubWeb3Storage);
  });

  let { request, getContainer } = setupHub(this);

  it('returns 401 without bearer token', async function () {
    await request()
      .post('/upload')
      .set('Content-Type', 'multipart/form-data')
      .attach('cat.jpeg', path.resolve(__dirname, '../mock-data/cat.jpeg'))
      .expect(401);
  });

  it('uploads an image', async function () {
    let dbManager = await getContainer().lookup('database-manager');
    let db = await dbManager.getClient();

    await request()
      .post('/upload')
      .set('Content-Type', 'multipart/form-data')
      .set('Authorization', 'Bearer: abc123--def456--ghi789')
      .attach('cat.jpeg', path.resolve(__dirname, '../mock-data/cat.jpeg'))
      .expect(200)
      .expect('https://cloudflare-ipfs.com/ipfs/CID/cat.jpeg');

    let queryResult = await db.query('SELECT id FROM uploads WHERE url = $1', [
      'https://cloudflare-ipfs.com/ipfs/CID/cat.jpeg',
    ]);

    expect(queryResult.rows.length).to.equal(1);
  });

  it('detects abuse', async function () {
    let dbManager = await getContainer().lookup('database-manager');
    let db = await dbManager.getClient();

    for (let index = 0; index < 10; index++) {
      await db.query(
        'INSERT INTO uploads(id, cid, service, url, filename, size, type, owner_address) VALUES($1, $2, $3, $4, $5, $6, $7, $8)',
        [
          shortUuid.uuid(),
          'CID',
          'web3.storage',
          'url',
          'test.jpg',
          100,
          'image/jpeg',
          '0x2f58630CA445Ab1a6DE2Bb9892AA2e1d60876C13',
        ]
      );
    }

    await request()
      .post('/upload')
      .set('Content-Type', 'multipart/form-data')
      .set('Authorization', 'Bearer: abc123--def456--ghi789')
      .attach('cat.jpeg', path.resolve(__dirname, '../mock-data/cat.jpeg'))
      .expect(429);
  });
});
