import { Server } from './server.js';
import { join } from 'path';

const cardCacheDir = join(__dirname, '..', '..', 'compiled');
const realms = [
  {
    url: 'https://cardstack.com/base',
    directory: join(__dirname, '..', '..', 'base-cards'),
  },
];
// @ts-ignore
let server = await Server.create({ realms, cardCacheDir });

server.app.listen(3000);
