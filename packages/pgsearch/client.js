const { Pool } = require('pg');
const Cursor = require('pg-cursor');
const migrate = require('node-pg-migrate').default;
const log = require('@cardstack/logger')('cardstack/pgsearch');
const { join } = require('path');

module.exports = class PgClient {
    static create() {
        return new this();
    }

    constructor(){
        // TODO read environment vars?
        this.config = {
            host: 'localhost',
            port: 5444,
            user: 'postgres',
            database: 'test1'
        };

        this.pool = new Pool({
            user: this.config.user,
            host: this.config.host,
            database: this.config.database,
            password: this.config.password,
            port: this.config.port
        });
    }

    static async teardown(instance) {
        if (instance.pool) {
            await instance.pool.end();
        }
    }

    async accomodateSchema(/* branch, schema */){
        // TODO: add specialized indices to postgres?
        await migrate({
            direction: 'up',
            migrationsTable: 'migrations',
            singleTransaction: true,
            checkOrder: false,
            databaseUrl: {
              user: this.config.user,
              host: this.config.host,
              database: this.config.database,
              password: this.config.password,
              port: this.config.port
            },
            dir: join(__dirname, 'migrations'),
            log: (...args) => log.debug(...args)
          });
    }

    async query(sql, params) {
        let client = await this.pool.connect();
        try {
            return await client.query(sql, params);
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

    async saveDocument({ branch, type, id, searchDoc, pristineDoc, source, generation, refs }) {
        let sql = 'insert into documents (branch, type, id, search_doc, pristine_doc, source, generation, refs) values ($1, $2, $3, $4, $5, $6, $7, $8) on conflict on constraint documents_pkey do UPDATE SET search_doc = EXCLUDED.search_doc, pristine_doc = EXCLUDED.pristine_doc, source = EXCLUDED.source, generation = EXCLUDED.generation, refs = EXCLUDED.refs';
        await this.query(sql, [branch, type, id, searchDoc, pristineDoc, source, generation, refs]);
    }

    async deleteOlderGenerations(branch, sourceId, nonce) {
       let sql = 'delete from documents where generation!=$1 and source=$2 and branch=$3';
       await this.query(sql, [nonce, sourceId, branch]);
    }

    async saveMeta({branch, id, params}) {
        let sql = 'insert into meta (branch, id, params) values ($1, $2, $3) on conflict on constraint meta_pkey do UPDATE SET params = EXCLUDED.params';
        await this.query(sql, [branch, id, params]);
    }

    async docsThatReference(branch, references, fn){        
        const queryBatchSize = 100;
        const rowBatchSize = 100;
        const sql = 'select pristine_doc from documents where branch=$1 and refs && $2';
        let client = await this.pool.connect();
        try {
            for (let i = 0; i < references.length; i += queryBatchSize){
                let queryRefs = references.slice(i, i + queryBatchSize);
                let cursor = client.query(new Cursor(sql, [branch, queryRefs]));
                let rows;
                do {
                    rows = await readCursor(cursor, rowBatchSize);
                    for (let row of rows){
                        await fn(row.pristine_doc);
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