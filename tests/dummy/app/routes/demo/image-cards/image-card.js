import BoxelizedRoute from 'boxel/routes/boxelized';

export default class DemoImageCardsImageCardRoute extends BoxelizedRoute {
  boxelPlane = 'space';

  model({ id }) {
    if (id === "2") {
      return { id, title: 'Haunted Mansion', image: '/images/haunted-castle.jpg', imageCredit: 'Naitian Wang' };
    }
    return { id, title: `Card ${id}` };
  }
}
