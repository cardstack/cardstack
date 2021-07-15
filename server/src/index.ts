import { Server } from './server';
import { join } from 'path';
import RealmManager from './realm-manager';

async function run() {
  let cardCacheDir = join(__dirname, '..', '..', 'compiled');

  let realms = new RealmManager([
    {
      url: 'https://cardstack.com/base/',
      directory: join(__dirname, '..', '..', 'base-cards'),
    },
    {
      url: 'https://demo.com/',
      directory: join(__dirname, '..', '..', 'demo-cards'),
    },
  ]);

  let server = await Server.create({
    realms,
    cardCacheDir,
    routeCard: 'https://demo.com/routes',
  });

  await server.startWatching();
  server.app.listen(3000);
}

run();
