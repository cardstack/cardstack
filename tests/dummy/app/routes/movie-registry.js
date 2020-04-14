import Route from '@ember/routing/route';
import IMDB from '../imdb';

export default class MovieRegistryRoute extends Route {
  model() {
    return IMDB;
  }
}
