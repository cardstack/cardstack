import { Factory } from 'ember-cli-mirage';
import faker from 'faker';

const imageTypes = ["animals", "business", "cats", "city", "food", "nightlife", "fashion", "people", "nature", "sports", "technics", "transport"];

export default Factory.extend({
  title(i) {
    return `Article ${i} - ${faker.random.words(3)}`;
  },

  description() {
    return faker.random.words(7);
  },

  body() {
    return faker.lorem.paragraphs(3);
  },

  publishedDate() {
    return faker.date.past().toLocaleDateString();
  },

  imageUrl() {
    return faker.image.imageUrl(640, 480, imageTypes[Math.floor(Math.random()*imageTypes.length)], true, true);
  },

  afterCreate(article, server) {
    if (!article.author) {
      article.update({
        author: server.create('person')
      });
    }
  }
});
