// import Route from '@ember/routing/route';
import BoxelizedRoute from 'boxel/routes/boxelized';

export default class FormCardsRoute extends BoxelizedRoute {
  boxelPlane = 'space';

  model() {
    return [
      { id : "1", title: 'Card 1' },
      { id : "2", title: 'Card 2' },
      { id : "3", title: 'Card 3' }
    ]
  }
}
