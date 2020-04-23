import Controller from "@ember/controller";
import { action } from "@ember/object";
import IMDB from "dummy/imdb";
import { timeout } from "ember-concurrency";

export default class CardSelectController extends Controller {
  movies = IMDB.movies.map(
    ({ id, title, type, year, poster: { type: posterType, value } }) => {
      return {
        id,
        title,
        type,
        year,
        poster: {
          type: posterType,
          value: `/assets/images/${value}`
        }
      };
    }
  );
  @action async search(term) {
    await timeout(300);

    return this.movies.filter(m =>
      m.title.value.toLowerCase().includes(term.toLowerCase())
    );
  }
}
