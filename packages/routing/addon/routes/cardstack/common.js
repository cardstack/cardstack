import Ember from 'ember';
import { singularize, pluralize } from 'ember-inflector';

export default Ember.Route.extend({
  cardstackRouting: Ember.inject.service(),

  _commonModelHook(type, slug) {
    let branch = this.modelFor('cardstack').branch;
    let {
      name,
      args,
      queryParams
    } = this.get('cardstackRouting').routeFor(type, slug, branch);
    if (name !== this.routeName) {
      this.replaceWith(name, ...args, { queryParams });
      return;
    }

    let plural = pluralize(type);
    if (type !== plural) {
      // our urls are only supposed to work with plural names
      let {
        name,
        args,
        queryParams
      } = this.get('cardstackRouting').routeFor(plural, slug, branch);
      this.replaceWith(name, ...args, { queryParams });
      return;
    }

    return this.store.queryRecord(singularize(type), {
      filter: { slug: { exact: slug } },
      branch
    }).catch(err => {
      if (!is404(err)) {
        throw err;
      }
      return {
        isCardstackPlaceholder: true,
        type: singularize(type),
        slug
      };
    });
  }
});


function is404(err) {
  return err.isAdapterError && err.errors && err.errors.length > 0 && err.errors[0].code === 404;
}
