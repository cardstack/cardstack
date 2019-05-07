const log = require('@cardstack/logger')('cardstack/pgsearch');
const Error = require('@cardstack/plugin-utils/error');
const { declareInjections } = require('@cardstack/di');
const {
  queryToSQL,
  param,
  every,
  addExplicitParens,
  any,
  separatedByCommas
} = require('./util');

const RANGE_OPERATORS = {
  lte: '<=',
  gte: '>=',
  lt: '<',
  gt: '>'
};

const PRIMARY_KEY = Object.freeze(['type', 'id']);

module.exports = declareInjections({
  currentSchema: 'hub:current-schema',
  client: `plugin-client:${require.resolve('./client')}`
}, class Searcher {
  constructor() {
    log.debug("constructed pgsearch searcher");
   }

  async get(session, type, id) {
    let response = await this.client.query(`select pristine_doc from documents where type=$1 and id=$2 and (expires is null or expires > now())`, [type, id]);
    if (response.rowCount > 0){
      return response.rows[0].pristine_doc;
    }
  }

  async search(session, { filter, sort, page, queryString }) {
    let realms = await session.realms();
    let schema = await this.currentSchema.getSchema();

    let conditions = [
      ['realms && ', param(realms) ],
      ['expires is null or expires > now()']
    ];

    if (filter) {
      conditions.push(this.filterCondition(schema, filter));
    }

    if (queryString) {
      conditions.push(this.queryCondition(queryString));
    }

    let totalResponsePromise = this.client.query(queryToSQL([`select count(*) from documents where`, ...every(conditions)]));

    let sorts = new Sorts(this, schema, sort);
    if (page && page.cursor) {
      conditions.push(sorts.afterExpression(page.cursor));
    }

    let query = [`select`, ...sorts.cursorColumns() ,`, pristine_doc from documents where`, ...every(conditions), ...sorts.orderExpression()];

    let size = 10;
    if (page && /^\d+$/.test(page.size)) {
      size = parseInt(page.size, 10);
    }
    query = [...query, "limit", param(size + 1) ];

    let sql = queryToSQL(query);
    log.trace("search: %s trace: %j", sql.text, sql.values);
    let response = await this.client.query(sql);
    let totalResponse = await totalResponsePromise;

    return this.assembleResponse(response, totalResponse, size, sorts);
  }

  async getUpstreamCard(type, id) {
    let response = await this.client.query(`select upstream_doc from documents where type=$1 and id=$2 and (expires is null or expires > now())`, [ type, id ]);
    if (response.rowCount > 0){
      return response.rows[0].upstream_doc;
    }
  }

  assembleResponse(response, totalResponse, requestedSize, sorts){
    let page = {
       // nobody has more than 2^53-1 total docs right?
      total: parseInt(totalResponse.rows[0].count, 10)
    };
    let documents = response.rows;
    if(response.rowCount > requestedSize){
      documents = documents.slice(0, requestedSize);
      let last = documents[documents.length - 1];
      page.cursor = sorts.getCursor(last);
    }
    let included = [];
    let data = documents.map(
      row => {
        let jsonapi = row.pristine_doc;
        if (jsonapi.included) {
          included = included.concat(jsonapi.included);
        }
        return jsonapi.data;
      }
    );
    return {
      data,
      included,
      meta: { page },
    };
  }

  queryCondition(value) {
    return [`q @@ plainto_tsquery('english', `, param(value), `)` ];
  }

  filterCondition(schema, filter){
    return every(Object.entries(filter).map(([key, value]) => {
      switch(key){
      case 'not':
        return ['NOT', ...addExplicitParens(this.filterCondition(schema, value))];
      case 'and':
        // 'and' is not strictly needed, since we already conjoin all
        // top-level conditions. But for completeness, it works.
        if (!Array.isArray(value)) {
          throw new Error(`the "and" operator must receive an array of other filters`, { status: 400 });
        }
        return every(value.map(item => this.filterCondition(schema, item)));
      case 'or':
        if (!Array.isArray(value)) {
          throw new Error(`the "or" operator must receive an array of other filters`, { status: 400 });
        }
        return any(value.map(item => this.filterCondition(schema, item)));
      default:
        return this.fieldFilter(schema, key, value);
      }
    }));
  }

  buildQueryExpression(schema, key, errorHint){
    if (key === 'type' || key === 'id'){
      return { isPlural: false, expression: [key], leafField: { buildValueExpression(value) { return [{ param: value }]; } } };
    }
    let segments = key.split('.');
    let partialPath = '';
    let currentContext = ['search_doc'];
    return this._buildQueryExpression(schema, segments, errorHint, partialPath, currentContext, false);
  }

  _buildQueryExpression(schema, segments, errorHint, partialPath, currentContext, insideHasMany) {
    let [ first, ...rest ] = segments;
    let fieldName = segments.shift();
    let field = schema.realAndComputedFields.get(fieldName);
    if (!field) {
      throw new Error(`Cannot ${errorHint} by unknown field "${partialPath}${fieldName}"`, {
        status: 400,
        title: `Unknown field in ${errorHint}`
      });
    }

    if (rest.length > 0) {
      if (!field.isRelationship){
        throw new Error(`Cannot ${errorHint} by unknown field "${partialPath}${fieldName}.${segments[0]}"`, {
          status: 400,
          title: `Unknown field in ${errorHint}`
        });
      }
      if (field.fieldType === '@cardstack/core-types::has-many') {
        let { expression, leafField } = this._buildQueryExpression(
          schema,
          rest,
          errorHint,
          `${partialPath}${first}.`,
          ['jsonb_array_elements(', ...currentContext, '->', param(field.id), ')' ],
          true
        );
        if (insideHasMany) {
          return { isPlural: true, expression, leafField };
        } else {
          return { isPlural: true, expression: ['array(select', ...expression, ')'], leafField };
        }
      } else {
        return this._buildQueryExpression(schema, rest, errorHint, `${partialPath}${first}.`, ['(', ...currentContext, ')->', param(field.id) ], insideHasMany);
      }
    } else {
       return { isPlural: false, expression: field.buildQueryExpression(currentContext), leafField: field };
    }
  }

  fieldFilter(schema, key, value) {
    if (Array.isArray(value)){
      return any(value.map(item => this.fieldFilter(schema, key, item)));
    }

    let { isPlural, expression, leafField } = this.buildQueryExpression(schema, key, 'filter');

    if (typeof value === 'string') {
      // TODO: Default query behavior is full-text matching. Switch to exact match instead.
      // TODO: this is super slow until we implement schema-dependent indices in postgres
      if (isPlural){
        return [`to_tsvector('english',`, `array_to_string(`, ...expression, `, ' ')`, `) @@ plainto_tsquery('english',`, ...leafField.buildValueExpression(value), `)` ];
      } else {
        return [`to_tsvector('english',`, ...expression, `) @@ plainto_tsquery('english',`, ...leafField.buildValueExpression(value), `)` ];
      }
    }

    if (value.exact) {
      if (Array.isArray(value.exact)) {
        // TODO: this is redundant, you could do the same thing more verbosely
        // by using an array above this point. And it's inconsistent with the
        // other operators that don't necessarily support arrays. We should
        // either make them all work or none work.
        return any(value.exact.map(item => this.fieldFilter(schema, key, { exact: item })));
      } else {
        if (isPlural){
          return [...expression, '&&', 'array[', ...leafField.buildValueExpression(value.exact), ']'];
        } else {
          return [ ...expression, '=', ...leafField.buildValueExpression(value.exact)];
        }
      }
    }

    if (isPlural){
      throw new Error(`this kind of query is not implemented across a has-many relationship`);
    }

    if (value.range) {
      return every(Object.keys(RANGE_OPERATORS).map(limit => {
        if (value.range[limit]) {
          return [...expression, RANGE_OPERATORS[limit], ...leafField.buildValueExpression(value.range[limit])];
        }
      }).filter(Boolean));
    }

    if (value.exists != null){
      if (String(value.exists) === "false") {
        return [...expression, "is null"];
      } else {
        return [...expression, "is not null"];
      }
    }

    if (value.prefix) {
      // Hassan there looks like a problem with this when the search string is over 8 chars, also we should support chars that commonly appear in filenames like "_"
      let param = value.prefix.replace(/[^a-zA-Z0-9]/g, '') + ":*";
      return [`to_tsvector('english',`, ...expression, `) @@ to_tsquery('english',`, ...leafField.buildValueExpression(param), `)` ];
    }
    throw new Error("Unimplemented field value");
  }


 });


class Sorts {
  constructor(searcher, schema, rawSorts){
    let sorts;
    if (rawSorts) {
      if (Array.isArray(rawSorts)){
        sorts = rawSorts.map(name => this.parseSort(searcher, schema, name));
      } else {
        sorts = [this.parseSort(searcher, schema, rawSorts)];
      }
    } else {
      sorts = [];
    }

    PRIMARY_KEY.forEach(name => {
      if (!sorts.find(entry => entry.name === name)) {
        sorts.push(this.parseSort(searcher, schema, name));
      }
    });
    this._sorts = sorts;
  }

  orderExpression() {
    return ['order by '].concat(separatedByCommas(this._sorts.map(({ expression, order }) => [...expression, order])));
  }

  afterExpression(cursor) {
    let cursorValues = this._parseCursor(cursor);
    return this._afterExpression(cursorValues, 0);
  }

  _afterExpression(cursorValues, index) {
    if(index === this._sorts.length) {
      return [false];
    }
    let { expression, order, leafField } = this._sorts[index];
    let value = leafField.buildValueExpression(cursorValues[index]);
    let operator = order === 'asc' ? '>' : '<';

    return ['(', ...expression, operator, ...value, ') OR ((', ...expression, '=', ...value, ') AND (', ...this._afterExpression(cursorValues, index + 1), '))'];
  }

  _parseCursor(cursor) {
    let cursorValues;
    try {
      cursorValues = JSON.parse(decodeURIComponent(cursor));
      if (cursorValues.length !== this._sorts.length) {
        throw new Error("Invalid cursor value", { status: 400 });
      }
    } catch (err) {
      throw new Error("Invalid cursor value", { status: 400 });
    }
    return cursorValues;
  }

  getCursor(lastRow) {
    return encodeURIComponent(JSON.stringify(this._sorts.map((unused, index)=> lastRow[`cursor${index}`])));
  }

  parseSort(searcher, schema, name){
    let realName, order;
    if (name.indexOf('-') === 0) {
      realName = name.slice(1);
      order = 'desc';
    } else {
      realName = name;
      order = 'asc';
    }
    let { expression, leafField } = searcher.buildQueryExpression(schema, realName, 'sort');
    return {
      name: realName,
      order,
      expression,
      leafField
     };
  }

  cursorColumns() {
    return separatedByCommas(this._sorts.map(({ expression }, index)=> {
      return [...expression, `AS cursor${index}`];
    }));
  }
}
