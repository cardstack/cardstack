import { Server } from './server';
import { join } from 'path';

async function run() {
  const cardCacheDir = join(__dirname, '..', '..', 'compiled');

  const realmConfigs = [
    {
      url: 'https://cardstack.com/base/',
      directory: join(__dirname, '..', '..', 'base-cards'),
    },
    {
      url: 'https://demo.com/',
      directory: join(__dirname, '..', '..', 'demo-cards'),
    },
  ];
  let server = await Server.create({
    realmConfigs,
    cardCacheDir,
    routeCard: 'https://demo.com/routes',
  });

  await server.startWatching();
  server.app.listen(3000);
}

run();
