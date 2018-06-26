const log = require('@cardstack/logger')('cardstack/pgsearch');
const Error = require('@cardstack/plugin-utils/error');
const { declareInjections } = require('@cardstack/di');

const RANGE_OPERATORS = {
  lte: '<=',
  gte: '>=', 
  lt: '<',
  gt: '>'
};

const PRIMARY_KEY = Object.freeze(['branch', 'type', 'id']);

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

  async search(session, branch, { filter, sort, page } ) {
    let realms = await session.realms();
    let schema = await this.schema.forBranch(branch);

    let conditions = [
      ['branch = ', { param: branch }],
      ['realms && ', { param: realms }]
    ];

    if (filter) {
      conditions.push(this.filterCondition(branch, schema, filter));
    }

    let sorts = new Sorts(this, schema, sort);
    if (page && page.cursor) {
      conditions.push(sorts.afterExpression(page.cursor));
    }

    let query = [`select`, ...sorts.cursorColumns() ,`, pristine_doc from documents where`, ...every(conditions), ...sorts.orderExpression()];

    let size = 10;
    if (page && /^\d+$/.test(page.size)) {
      size = parseInt(page.size, 10);
    }
    query = [...query, "limit", {param: size + 1}];
  
    let sql = queryToSQL(query);
    log.trace("search %s %j", sql.text, sql.values);
    let response = await this.client.query(sql);

    return this.assembleResponse(response, size, sorts);
  }

  assembleResponse(response, requestedSize, sorts){
    let page = {};
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

  buildQueryExpression(schema, key, errorHint){
    if (key === 'branch' || key === 'type' || key === 'id'){
      return { isPlural: false, expression: [key] };
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
        let { expression } = this._buildQueryExpression(
          schema, 
          rest, 
          errorHint, 
          `${partialPath}${first}.`, 
          ['jsonb_array_elements(', ...currentContext, '->', { param: field.id }, ')' ],
          true
        );
        if (insideHasMany) {
          return { isPlural: true, expression };
        } else {
          return { isPlural: true, expression: ['array(select', ...expression, ')'] };
        }
      } else {
        return this._buildQueryExpression(schema, rest, errorHint, `${partialPath}${first}.`, ['(', ...currentContext, ')->', { param: field.id } ], insideHasMany);
      }
    } else {
       return { isPlural: false, expression: field.buildQueryExpression(currentContext) };
    }
  }

  fieldFilter(branch, schema, key, value) {
    if (Array.isArray(value)){
      return any(value.map(item => this.fieldFilter(branch, schema, key, item)));
    }

    let { isPlural, expression } = this.buildQueryExpression(schema, key, 'filter');

    if (typeof value === 'string') {
      // TODO: Default query behavior is full-text matching. Switch to exact match instead.
      // TODO: this is super slow until we implement schema-dependent indices in postgres
      if (isPlural){
        return [`to_tsvector('english',`, `array_to_string(`, ...expression, `, ' ')`, `) @@ plainto_tsquery('english',`, { param: value }, `)` ];
      } else {
        return [`to_tsvector('english',`, ...expression, `) @@ plainto_tsquery('english',`, { param: value }, `)` ];
      }
    }

    if (value.exact) {
      if (Array.isArray(value.exact)) {
        // TODO: this is redundant, you could do the same thing more verbosely
        // by using an array above this point. And it's inconsistent with the
        // other operators that don't necessarily support arrays. We should
        // either make them all work or none work.
        return any(value.exact.map(item => this.fieldFilter(branch, schema, key, { exact: item })));
      } else {
        if (isPlural){
          return [...expression, '&&', { param: [value.exact] }];
        } else {
          return [ ...expression, '=', { param: value.exact }];
        }
      }
    }

    if (isPlural){
      throw new Error(`this kind of query is not implemented across a has-many relationship`);
    }

    if (value.range) {
      return every(Object.keys(RANGE_OPERATORS).map(limit => {
        if (value.range[limit]) {
          return [...expression, RANGE_OPERATORS[limit], { param: value.range[limit] }];
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
      let param = value.prefix.replace(/[^a-zA-Z0-9]/g, '') + ":*";
      return [`to_tsvector('english',`, ...expression, `) @@ to_tsquery('english',`, { param }, `)` ];
    }
    throw new Error("Unimplemented field value");
  }

  
 });

function addExplicitParens(expression){
  if (expression.length === 0) {
    return expression;
  } else {
    return ['(', ...expression, ')'];
  }
}

function separatedByCommas(expressions) {
  return expressions.reduce((accum, expression) => {
    if (accum.length > 0){
      accum.push(',');
    }
    return accum.concat(expression);
  }, []);
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
    if (element.hasOwnProperty('param')) {
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
    let { expression, order } = this._sorts[index];
    let value = { param: cursorValues[index] };
    let operator = order === 'asc' ? '>' : '<';

    return ['(', ...expression, operator, value, ') OR ((', ...expression, '=', value, ') AND (', ...this._afterExpression(cursorValues, index + 1), '))'];
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
    let { expression } = searcher.buildQueryExpression(schema, realName, 'sort');
    return { 
      name: realName, 
      order,
      expression
     };
  }

  cursorColumns() {
    return separatedByCommas(this._sorts.map(({ expression }, index)=> {
      return [...expression, `AS cursor${index}`];
    }));
  }
}