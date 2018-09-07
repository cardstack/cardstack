const TextRenderer = require('mobiledoc-text-renderer').default;
const renderer = new TextRenderer({cards: []});

const WORDS_PER_MIN = 200;

exports.type = '@cardstack/core-types::integer';

exports.compute = async function(model, { sourceField }) {
  let mobiledoc = await model.getField(sourceField);
  let bodyText = renderer.render(mobiledoc).result;

  return Math.round(bodyText.split(' ').length / WORDS_PER_MIN);
};
