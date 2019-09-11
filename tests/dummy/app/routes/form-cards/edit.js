import BoxelizedRoute from 'boxel/routes/boxelized';

export default class FormCardsEditRoute extends BoxelizedRoute {
  boxelPlane = 'tools';

  model({ id }) {
    return { id, title: `Card ${id}` };
  }
}
