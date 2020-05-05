import Route from '@ember/routing/route';

export default class MovieRegistryVersionsRoute extends Route {
  model({ id }) {
    let { versioning, movies } = this.modelFor('movie-registry');
    let { versions } = versioning.filter(item => item.movieId === id)[0];
    let movie = movies.filter(item => item.id === id)[0];
    return {
      versions,
      movie
    }
  }
}
