import faker from 'faker';
import ENV from "dummy/config/environment";

const imageTypes = ["community", "developer", "feature", "token"];

export default [
  {
    id: 'sample',
    title: `Sample Article`,
    description: faker.random.words(5),
    publishedDate: faker.date.past().toLocaleDateString(),
    imageUrl: `${ENV.rootURL}images/${imageTypes[Math.floor(Math.random()*imageTypes.length)]}-${Math.ceil(Math.random()*4)}.png`,
    authorId: '1',
    body: 'Zombie ipsum reversus ab viral inferno, nam rick grimes malum cerebro. De carne lumbering animata corpora quaeritis. Summus brains sit , morbo vel maleficia? De apocalypsi gorger omero undead survivor dictum mauris. Hi mindless mortuis soulless creaturas, imo evil stalking monstra adventus resi dentevil vultus comedat cerebella viventium.',
    mode: 'view'
  }
]
