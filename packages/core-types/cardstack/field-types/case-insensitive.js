module.exports = {
  valid(value) {
    return typeof value === 'string';
  },
  defaultMapping() {
    return {
      type: "text",
      analyzer: "case_insensitive_keyword_analyzer"
    };
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
