import Route from '@ember/routing/route';

export default class MovieRoute extends Route {
  model({ id }) {
    let { movies } = this.modelFor('movie-registry');
    return movies.filter(item => item.id === id)[0];
  }
}
