// import { Argv } from 'yargs';
import { createContainer } from '../../main';

exports.command = 'prime';
exports.desc = 'Prime the card cache';

exports.builder = {};

exports.handler = async function (/* argv: Argv */) {
  let container = createContainer();
  let searchIndex = await container.lookup('searchIndex', { type: 'service' });
  await searchIndex.indexAllRealms();
};
