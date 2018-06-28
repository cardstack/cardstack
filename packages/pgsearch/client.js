
const { Pool, Client } = require('pg');
const Cursor = require('pg-cursor');
const migrate = require('node-pg-migrate').default;
const log = require('@cardstack/logger')('cardstack/pgsearch');
const { join } = require('path');

// TODO: once our migrations is complete, rename this env var everywhere because
// it's no longer about elasticsearch and it's not a prefix.
const dbSuffix = process.env.ELASTICSEARCH_PREFIX || 'content';

// TODO just rely on the standard PG env vars:
// https://www.postgresql.org/docs/9.1/static/libpq-envars.html
// but check that pg-migrate does too
const config = {
    host: 'localhost',
    port: 5444,
    user: 'postgres',
    database: `pgsearch_${dbSuffix}`
};


module.exports = class PgClient {
    static create() {
        return new this();
    }

    constructor(){

        this.pool = new Pool({
            user: config.user,
            host: config.host,
            database: config.database,
            password: config.password,
            port: config.port
        });

        this._didEnsureDatabaseSetup = false;
    }

    static async teardown(instance) {
        if (instance.pool) {
            await instance.pool.end();
        }
    }

    async ensureDatabaseSetup() {
        if (this._didEnsureDatabaseSetup){
            return;
        }

        let client = new Client(Object.assign({}, config, { database: 'postgres' }));
        try {
            await client.connect();
            let response = await client.query(`select count(*)=1 as has_database from pg_database where datname=$1`, [config.database]);
            if (!response.rows[0].has_database) {
                await client.query(`create database ${safeDatabaseName(config.database)}`);
            }
        } finally {
            client.end();
        }

        await migrate({
            direction: 'up',
            migrationsTable: 'migrations',
            singleTransaction: true,
            checkOrder: false,
            databaseUrl: {
              user: config.user,
              host: config.host,
              database: config.database,
              password: config.password,
              port: config.port
            },
            dir: join(__dirname, 'migrations'),
            log: (...args) => log.debug(...args)
        });
    }

    static async deleteSearchIndexIHopeYouKnowWhatYouAreDoing() {
        let client = new Client(Object.assign({}, config, { database: 'postgres' }));
        try {
            await client.connect();
            await client.query(`drop database if exists ${safeDatabaseName(config.database)}`);
        } finally {
            client.end();
        }
    }

    async accomodateSchema(/* branch, schema */){
        await this.ensureDatabaseSetup();
        // TODO: add specialized indices to postgres?
    }

    async query(...args) {
        let client = await this.pool.connect();
        try {
            return await client.query(...args);
        }
        finally {
            client.release();
        }
    }

    async loadMeta({ branch, id }) {
        let response = await this.query('SELECT params from meta where branch=$1 and id=$2', [branch, id]);
        if (response.rowCount > 0){
            return response.rows[0].params;
        }
    }

    async readUpstreamDocument({ branch, type, id }) {
        let sql = 'select upstream_doc from documents where branch=$1 and type=$2 and id=$3';
        let response = await this.query(sql, [branch, type, id]);
        if (response.rowCount > 0) {
            return response.rows[0].upstream_doc;
        }
    }

    async saveDocument({ branch, type, id, searchDoc, pristineDoc, upstreamDoc, source, generation, refs, realms }) {
        let sql = 'insert into documents (branch, type, id, search_doc, pristine_doc, upstream_doc, source, generation, refs, realms) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) on conflict on constraint documents_pkey do UPDATE SET search_doc = EXCLUDED.search_doc, pristine_doc = EXCLUDED.pristine_doc, upstream_doc = EXCLUDED.upstream_doc, source = EXCLUDED.source, generation = EXCLUDED.generation, refs = EXCLUDED.refs, realms = EXCLUDED.realms';
        await this.query(sql, [branch, type, id, searchDoc, pristineDoc, upstreamDoc, source, generation, refs, realms]);
    }

    async deleteOlderGenerations(branch, sourceId, nonce) {
       let sql = 'delete from documents where (generation != $1 or generation is null) and source=$2 and branch=$3';
       await this.query(sql, [nonce, sourceId, branch]);
    }

    async deleteDocument({ branch, type, id }) {
       let sql = 'delete from documents where branch=$1 and type=$2 and id=$3';
       await this.query(sql, [branch, type, id]);
    }

    async saveMeta({branch, id, params}) {
        let sql = 'insert into meta (branch, id, params) values ($1, $2, $3) on conflict on constraint meta_pkey do UPDATE SET params = EXCLUDED.params';
        await this.query(sql, [branch, id, params]);
    }

    async docsThatReference(branch, references, fn){
        const queryBatchSize = 100;
        const rowBatchSize = 100;
        const sql = 'select upstream_doc, refs from documents where branch=$1 and refs && $2';
        let client = await this.pool.connect();
        try {
            for (let i = 0; i < references.length; i += queryBatchSize){
                let queryRefs = references.slice(i, i + queryBatchSize);
                let cursor = client.query(new Cursor(sql, [branch, queryRefs]));
                let rows;
                do {
                    rows = await readCursor(cursor, rowBatchSize);
                    for (let row of rows){
                        await fn(row.upstream_doc, row.refs);
                    }
                } while (rows.length > 0);
            }
        }
        finally {
            client.release();
        }

    }
};

function readCursor(cursor, rowCount){
    return new Promise((resolve, reject) => {
        cursor.read(rowCount, (err, rows) => {
            if (err) {
                reject(err);
            } else {
                resolve(rows);
            }
        });
    });
}

function safeDatabaseName(name){
    if (!/^[a-zA-Z_0-9]+$/.test(name)){
        throw new Error(`unsure if db name ${name} is safe`);
    }
    return name;
}