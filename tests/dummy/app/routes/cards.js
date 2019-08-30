import BoxelizedRoute from 'boxel/routes/boxelized';

export default class CardsRoute extends BoxelizedRoute {
  boxelPlane = 'space';

  model() {
    return [
      { id : "1", title: 'Card 1' },
      { id : "2", title: 'Card 2' },
      { id : "3", title: 'Card 3' }
    ]
  }
}
