import { Server } from './server';
import { join } from 'path';

async function run() {
  const cardCacheDir = join(__dirname, '..', '..', 'compiled');

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

  await server.startWatching();
  server.app.listen(3000);
}

run();
