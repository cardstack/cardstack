import { Server } from './server';
import { join } from 'path';
import { glob } from 'glob';
import fs from 'fs';

async function run() {
  const cardCacheDir = join(__dirname, '..', '..', 'compiled');

  cleanCache(cardCacheDir);

  const realms = [
    {
      url: 'https://cardstack.com/base/',
      directory: join(__dirname, '..', '..', 'base-cards'),
    },
    {
      url: 'http://demo.com/',
      directory: join(__dirname, '..', '..', 'demo-cards'),
    },
  ];
  let server = await Server.create({ realms, cardCacheDir });

  server.start(3000);
}

function cleanCache(dir: string) {
  console.debug('Cleaning cardCache dir: ' + dir);
  for (let file of glob.sync('http*', { cwd: dir })) {
    fs.rmSync(join(dir, file));
  }
}

run();
