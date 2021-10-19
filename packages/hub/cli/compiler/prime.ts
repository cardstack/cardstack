// import { Argv } from 'yargs';
import { HubServer } from '../../main';
import { errorCatcher } from '../../utils/cli';

exports.command = 'prime';
exports.desc = 'Prime the card cache';

exports.builder = {};

exports.handler = async function (/* argv: Argv */) {
  let server = await HubServer.create();
  await server.primeCache().catch(errorCatcher);
};
