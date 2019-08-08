import faker from 'faker';

const imageTypes = ["animals", "business", "cats", "city", "food", "nightlife", "fashion", "people", "nature", "sports", "technics", "transport"];

export default [
  {
    id: 'sample',
    title: `Sample Event - ${faker.random.words(3)}`,
    description: faker.random.words(7),
    publishedDate: faker.date.past().toLocaleDateString(),
    imageUrl: faker.image.imageUrl(640, 480, imageTypes[Math.floor(Math.random()*imageTypes.length)], true, true),
    authorId: '2'
  }
]
