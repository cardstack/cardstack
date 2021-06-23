/* eslint-disable camelcase */
const { readFileSync } = require('fs-extra');
const path = require('path');

exports.shorthands = undefined;

const escapedWorkerSchema = 'graphile_worker';

exports.up = (pgm) => {
  pgm.sql(
    `
    create extension if not exists pgcrypto with schema public;
    create schema ${escapedWorkerSchema};
    create table ${escapedWorkerSchema}.migrations(
      id int primary key,
      ts timestamptz default now() not null
    );
    `
  );
  let sqlDirPath = path.join(require.resolve('graphile-worker'), '../../sql');
  for (const fileName of ['000001', '000002', '000003', '000004', '000005', '000006', '000007', '000008']) {
    let sqlTemplate = readFileSync(path.join(sqlDirPath, `${fileName}.sql`), { encoding: 'utf8' });
    const sql = sqlTemplate.replace(/:GRAPHILE_WORKER_SCHEMA\b/g, 'graphile_worker');
    pgm.sql(sql);

    pgm.sql(`insert into ${escapedWorkerSchema}.migrations (id) values ('${fileName}')`);
  }
};

exports.down = (pgm) => {
  pgm.sql(`DROP SCHEMA ${escapedWorkerSchema} CASCADE`);
};
