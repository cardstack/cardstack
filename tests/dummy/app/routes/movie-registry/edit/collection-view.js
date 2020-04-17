import Route from '@ember/routing/route';

export default class MovieRegistryEditCollectionViewRoute extends Route {
  model({ collectionId }) {
    let movie = this.modelFor('movie-registry.edit');
    for (let field in movie) {
      if (movie[field].id === collectionId) {
        return movie[field];
      }
    }
  }
}
