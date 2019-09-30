import BoxelizedRoute from 'boxel/routes/boxelized';

export default class DemoImageCardsRoute extends BoxelizedRoute {
  boxelPlane = 'space';

  model() {
    return [
      { id : "1", title: 'Card 1' },
      { id : "2", title: 'Haunted Mansion', image: '/images/haunted-castle.jpg', imageCredit: 'Naitian Wang' },
      { id : "3", title: 'Card 3' }
    ]
  }
}
