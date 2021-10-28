import * as bot from './bot';
import * as compiler from './compiler';
import * as console from './console';
import * as db from './db';
import * as server from './server';
import * as worker from './worker';

export const commands = [bot, compiler, console, db, server, worker];
