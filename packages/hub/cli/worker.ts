import dotenv from 'dotenv';
import { bootWorker } from '../main';

exports.command = 'worker';
exports.describe = 'Boot the worker';
exports.builder = {};
exports.handler = function (/* argv: Argv */) {
  dotenv.config();
  bootWorker();
};
