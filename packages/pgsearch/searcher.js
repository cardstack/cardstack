const log = require('@cardstack/logger')('cardstack/pgsearch');
const Error = require('@cardstack/plugin-utils/error');
const { declareInjections } = require('@cardstack/di');

const RANGE_OPERATORS = {
  lte: '<=',
  gte: '>=', 
  lt: '<',
  gt: '>'
};

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

  async search(session, branch, { queryString, filter, sort, page } ) {
    let realms = await session.realms();
    let schema = await this.schema.forBranch(branch);

    let conditions = [
      ['branch = ', { param: branch }],
      ['realms && ', { param: realms }]
    ];

    if (filter) {
      conditions.push(this.filterCondition(branch, schema, filter));
    }

    let query = [`select pristine_doc from documents where`, ...every(conditions)];

    if (sort) {
      query = query.concat(this.buildSorts(schema, sort));
    }

    let sql = queryToSQL(query);
    log.trace("search %s %j", sql.text, sql.values);
    let response = await this.client.query(sql);
    return { data: response.rows.map(row => row.pristine_doc.data)};
  }

  filterCondition(branch, schema, filter){
    return every(Object.entries(filter).map(([key, value]) => {
      switch(key){
      case 'not':
        return ['NOT', ...addExplicitParens(this.filterCondition(branch, schema, value))];
      case 'and':
        // 'and' is not strictly needed, since we already conjoin all
        // top-level conditions. But for completeness, it works.
        if (!Array.isArray(value)) {
          throw new Error(`the "and" operator must receive an array of other filters`, { status: 400 });
        }      
        return every(value.map(item => this.filterCondition(branch, schema, item)));
      case 'or':
        if (!Array.isArray(value)) {
          throw new Error(`the "or" operator must receive an array of other filters`, { status: 400 });
        }
        return any(value.map(item => this.filterCondition(branch, schema, item)));
      default:
        return this.fieldFilter(branch, schema, key, value);
      }
    }));
  }

  fieldFilter(branch, schema, key, value) {
    let field = schema.realAndComputedFields.get(key);
    if (!field) {
      throw new Error(`Cannot filter by unknown field "${key}"`, {
        status: 400,
        title: "Unknown field in filter"
      });
    }
    let expression = field.buildQueryExpression(['search_doc']);
    if (typeof value === 'string') {
      return [ ...expression, '=', { param: value }];
    }
    if (Array.isArray(value)){
      return any(value.map(item => this.fieldFilter(branch, schema, key, item)));
    }
    if (value.range) {
      return every(Object.keys(RANGE_OPERATORS).map(limit => {
        if (value.range[limit]) {
          return [...expression, RANGE_OPERATORS[limit], { param: value.range[limit] }];
        }
      }).filter(Boolean));
    }
    throw new Error("Unimplemented field value");
  }

  buildSorts(schema, sorts){
    let expressions;
    if (Array.isArray(sorts)){
      if (sorts.length === 0){
        return [];
      }
      expressions = sorts.map(name => this.buildSort(schema, name));
    } else {
      expressions = [this.buildSort(schema, sorts)];
    }
    return ['order by '].concat(expressions.reduce((accum, item) => {
      if (accum.length > 0){
        accum.push(',');
      }
      return accum.concat(item);
    }, []));
  }

  buildSort(schema, name){
    let realName, order;
    if (name.indexOf('-') === 0) {
      realName = name.slice(1);
      order = 'desc';
    } else {
      realName = name;
      order = 'asc';
    }
    let field = schema.realAndComputedFields.get(realName);
    if (!field) {
      throw new Error(`Cannot sort by unknown field "${realName}"`, {
        status: 400,
        title: "Unknown sort field"
      });
    }
    return [...field.buildQueryExpression(['search_doc']), order];
  }
 });

function addExplicitParens(expression){
  return ['(', ...expression, ')'];
}

function every(expressions){
  if (expressions.length === 0){
    return ['true'];
  }
  return expressions.map(addExplicitParens).reduce((accum, expression) => [...accum, 'AND', ...expression]);
}

function any(expressions){
  if (expressions.length === 0){
    return ['false'];
  }
  return expressions.map(addExplicitParens).reduce((accum, expression) => [...accum, 'OR', ...expression]);
}

function queryToSQL(query){
  let values = [];
  let text = query.map(element =>{
    if (element.param) {
      values.push(element.param);
      return `$${values.length}`;
    } else {
      return element;
    }
  }).join(' ');
  return {
    text,
    values
  };
}