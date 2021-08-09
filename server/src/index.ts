import { Server } from './server';
import { join } from 'path';
import RealmManager from './realm-manager';
import yargs from 'yargs/yargs';
import { hideBin } from 'yargs/helpers';

const cardCacheDir = join(__dirname, '..', '..', 'compiled');

const realms = new RealmManager([
  {
    url: 'https://cardstack.com/base/',
    directory: join(__dirname, '..', '..', 'base-cards'),
  },
  {
    url: 'https://demo.com/',
    directory: join(__dirname, '..', '..', 'demo-cards'),
  },
]);

async function serve(args: any) {
  let server = await Server.create({
    realms,
    cardCacheDir,
    routeCard: args.routeCard,
  });

  await server.primeCache();
  await server.startWatching();
  server.app.listen(args.port);
}

async function prime() {
  let server = await Server.create({
    realms,
    cardCacheDir,
  });

  await server.primeCache();
}

yargs(hideBin(process.argv))
  .command(
    'serve',
    'start the server',
    (yargs) => {
      return yargs
        .option('port', {
          alias: 'p',
          type: 'number',
          description: 'Port to bind on',
          default: 3000,
        })
        .option('routeCard', {
          type: 'string',
          description: 'URL for servers route card',
          default: 'https://demo.com/routes',
        });
    },
    serve
  )
  .command('prime', 'prime the server cache', prime)
  .demandCommand()
  .help().argv;
