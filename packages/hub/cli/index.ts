import * as bot from './bot';
import * as compiler from './compiler';
import * as console from './console';
import * as db from './db';
import * as server from './server';
import * as worker from './worker';

export const commands: any[] = [bot, console, db, server, worker];

if (process.env.COMPILER) {
  commands.push(compiler);
}
