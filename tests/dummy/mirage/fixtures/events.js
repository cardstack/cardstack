import faker from 'faker';
import ENV from "dummy/config/environment";

const imageTypes = ["community", "developer", "feature", "token"];

export default [
  {
    id: 'sample',
    title: `Sample Event - ${faker.random.words(3)}`,
    datetime: faker.date.future(),
    description: faker.random.words(7),
    publishedDate: faker.date.past().toLocaleDateString(),
    imageUrl: `${ENV.rootURL}images/${imageTypes[Math.floor(Math.random()*imageTypes.length)]}-${Math.ceil(Math.random()*4)}.png`,
    authorId: '2',
    location: `${faker.address.streetAddress()}, ${faker.address.city()}, ${faker.address.state()}`,
    body: `${faker.random.words(10)}. ${faker.random.words(16)}. ${faker.random.words(12)}.`
  },
  {
    id: '1',
    title: 'Ember Meetup NYC',
    imageUrl: '/images/haunted-castle.jpg',
    location: 'New York, NY',
    price: 'Free Admission',
    address: 'One World Trade Center',
    datetime: '2019-09-26T23:00:00.000Z',
    description: 'Zombie ipsum reversus ab viral inferno, nam rick grimes malum cerebro. De carne lumbering animata corpora quaeritis. Summus brains sit , morbo vel maleficia? De apocalypsi gorger omero undead survivor dictum mauris. Hi mindless mortuis soulless creaturas, imo evil stalking monstra adventus resi dentevil vultus comedat cerebella viventium.'
  },
  {
    id: '2',
    title: 'Ember Meetup London',
    imageUrl: `${ENV.rootURL}images/${imageTypes[Math.floor(Math.random()*imageTypes.length)]}-${Math.ceil(Math.random()*4)}.png`,
    location: 'London, UK',
    price: 'Free Admission',
    address: 'Somewhere in London',
    datetime: '2019-10-21T23:00:00.000Z',
    description: 'Zombie ipsum reversus ab viral inferno, nam rick grimes malum cerebro. De carne lumbering animata corpora quaeritis. Summus brains sit , morbo vel maleficia? De apocalypsi gorger omero undead survivor dictum mauris. Hi mindless mortuis soulless creaturas, imo evil stalking monstra adventus resi dentevil vultus comedat cerebella viventium.'
  }
]
