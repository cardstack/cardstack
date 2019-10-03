import Route from '@ember/routing/route';

export default class DemoFormCardsEditRoute extends Route {
  model({ id }) {
    return { id, title: `Card ${id}` };
  }
}
