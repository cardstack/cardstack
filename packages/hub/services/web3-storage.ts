import { Web3Storage as Storage } from 'web3.storage';
import { getFilesFromPath } from 'web3.storage';
import { Filelike } from 'web3.storage/dist/src/lib/interface';
import config from 'config';

export default class Web3Storage {
  async upload(path: string, name: string) {
    const client = new Storage({
      token: config.get('web3storage.token'),
    });

    let files = await getFilesFromPath(path);
    files[0].name = name;

    let cid = await client.put(files as Iterable<Filelike>);
    return cid;
  }
}

declare module '@cardstack/di' {
  interface KnownServices {
    'web3-storage': Web3Storage;
  }
}
