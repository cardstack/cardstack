import Route from '@ember/routing/route';

export default class ArticlesRoute extends Route {
  model({ id }) {
    return this.store.findRecord('article', id);
  }

  renderTemplate(/*controller, model*/) {
    this.render('articles', {
      into: 'application',
      outlet: 'space'
    });
  }
}
