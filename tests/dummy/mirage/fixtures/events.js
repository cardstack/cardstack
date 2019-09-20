import faker from 'faker';
import ENV from "dummy/config/environment";

const imageTypes = ["community", "developer", "feature", "token"];

export default [
  {
    id: 'sample',
    title: `Sample Event - ${faker.random.words(3)}`,
    description: faker.random.words(7),
    publishedDate: faker.date.past().toLocaleDateString(),
    imageUrl: `${ENV.rootURL}images/${imageTypes[Math.floor(Math.random()*imageTypes.length)]}-${Math.ceil(Math.random()*4)}.png`,
    authorId: '2',
    body: 'Zombie ipsum reversus ab viral inferno, nam rick grimes malum cerebro. De carne lumbering animata corpora quaeritis. Summus brains sit , morbo vel maleficia? De apocalypsi gorger omero undead survivor dictum mauris. Hi mindless mortuis soulless creaturas, imo evil stalking monstra adventus resi dentevil vultus comedat cerebella viventium.'
  },
  {
    id: '1',
    title: 'Ember Meetup NYC',
    date: 'SEPT 20',
    imageUrl: '/images/haunted-castle.jpg',
    location: 'New York, NY',
    price: 'Free Admission'
  },
  {
    id: '2',
    title: 'Ember Meetup London',
    date: 'SEPT 21',
    imageUrl: `${ENV.rootURL}images/${imageTypes[Math.floor(Math.random()*imageTypes.length)]}-${Math.ceil(Math.random()*4)}.png`,
    location: 'London, UK',
    price: 'Free Admission'
  }
]
