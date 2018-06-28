module.exports = {
  valid(value) {
    return typeof value === 'string';
  },


  buildQueryExpression(sourceExpression, name){
    return ['lower(', ...sourceExpression, '->>', { param: name }, ')'];
  },

  buildValueExpression(valueExpression) {
    return ['lower(', ...valueExpression, ')'];
  },

  defaultMapping() {
    return {
      type: "text",
      analyzer: "case_insensitive_keyword_analyzer"
    };
  },

  queryTermFormatter(term) {
    return term.toLowerCase();
  },

  customAnalyzer() {
    return {
      case_insensitive_keyword_analyzer: {
        tokenizer: "keyword",
        filter: [
          "lowercase"
        ]
      }
    };
  }
};
