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

function param(value) {
  return { param: value };
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

function safeName(name) {
  if (!/^[a-zA-Z0-9_]+$/.test(name)) {
    throw new Error(`potentially unsafe name in SQL: ${name}`);
  }
  return name;
}

// takes a pojo with column name keys and expression values
function upsert(table, constraint, values) {
  let names = Object.keys(values).map(safeName);
  let nameExpressions = names.map(name => [name]);
  let valueExpressions = Object.keys(values).map(k => {
    let v = values[k];
    if (!Array.isArray(v) && !v.hasOwnProperty('param')) {
      throw new Error(`values passed to upsert helper must already be expressions. You passed ${v} for ${k}`);
    }
    return v;
  });
  return ['insert into', safeName(table),
    ...addExplicitParens(separatedByCommas(nameExpressions)),
    'values',
    ...addExplicitParens(separatedByCommas(valueExpressions)),
    'on conflict on constraint', safeName(constraint),
    'do UPDATE SET',
                                           // this interpolation is safe because
                                           // of safeName() above. In general
                                           // don't add any more interpolations
                                           // unless you've really thought hard
                                           // about the security implications.
    ...separatedByCommas(names.map(name => `${name}=EXCLUDED.${name}`))
  ];
}

module.exports = {
  addExplicitParens,
  separatedByCommas,
  param,
  every,
  any,
  queryToSQL,
  upsert
};
