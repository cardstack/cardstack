// import { Argv } from 'yargs';
import { HubServer } from '../../main';

exports.command = 'prime';
exports.desc = 'Prime the card cache';

exports.builder = {};

exports.handler = async function (/* argv: Argv */) {
  let server = await HubServer.create();
  await server.primeCache();
};
