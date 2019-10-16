import BoxelizedRoute from '@cardstack/boxel/routes/boxelized';

export default class CardsRoute extends BoxelizedRoute {
  boxelPlane = 'space';

  model() {
    return [
      { id : "1", title: 'Card 1', description: 'This is the description of Card 1', expanded: false },
      { id : "2", title: 'Card 2', description: 'This is the description of Card 2', expanded: false },
      { id : "3", title: 'Card 3', description: 'This is the description of Card 3', expanded: false }
    ]
  }
}
