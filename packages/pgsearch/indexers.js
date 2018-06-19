const { Pool } = require('pg');
const migrate = require('node-pg-migrate').default;
const log = require('@cardstack/logger')('cardstack/pgsearch');
const { join } = require('path');

module.exports = class Indexers {
    static async create() {
        return new this();
    }

    constructor(){
        // TODO read environment vars?
        this.config = {
            host: 'localhost',
            port: 5444,
            user: 'postgres',
            database: 'postgres'
        };

        this.pool = new Pool({
            user: this.config.user,
            host: this.config.host,
            database: this.config.database,
            password: this.config.password,
            port: this.config.port
        });
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
};