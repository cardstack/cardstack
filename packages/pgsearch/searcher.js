const log = require('@cardstack/logger')('cardstack/pgsearch');
const Error = require('@cardstack/plugin-utils/error');
const { declareInjections } = require('@cardstack/di');


module.exports = declareInjections({
  schema: 'hub:current-schema',
  client: `plugin-client:${require.resolve('./client')}`
}, class Searcher {
  constructor() {
    log.debug("constructed pgsearch searcher");
   }

  async get(session, branch, type, id) {
    let response = await this.client.query('select pristine_doc from documents where branch=$1 and type=$2 and id=$3', [branch, type, id]);
    if (response.rowCount > 0){
      return response.rows[0].pristine_doc;
    }
  }

  async search(/*session, branch, { queryString, filter, sort, page } */) {
    throw new Error("Unimplemented");
  }
 
});
