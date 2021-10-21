// import { Argv } from 'yargs';
import { createContainer } from '../../main';

exports.command = 'prime';
exports.desc = 'Prime the card cache';

exports.builder = {};

exports.handler = async function (/* argv: Argv */) {
  let container = createContainer();
  let builder = await container.lookup('card-builder');
  await builder.primeCache(true);
};
