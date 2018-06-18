const { Pool } = require('pg');

module.exports = class Indexers {
    static async create() {
        return new this();
    }

    constructor(){
        this.pool = new Pool({
        });
    }

    async accomodateSchema(/* branch, schema */){
        // TODO: add specialized indices to postgres?
    }
};