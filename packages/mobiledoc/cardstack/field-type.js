const TextRenderer = require('mobiledoc-text-renderer').default;
const renderer = new TextRenderer({ cards: [] });

module.exports = {
  valid(value) {
    return typeof value === 'object' && value.hasOwnProperty('version');
  },

  searchIndexFormat(value) {
    if(value) {
      return renderer.render(value).result;
    }
  }

};
