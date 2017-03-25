import Ember from 'ember';
const { hash } = Ember.RSVP;

export default Ember.Route.extend({
  model() {
    return hash({
      master: this.store.findRecord('cardstack-generic', 'master/page/1'),
      draft: this.store.findRecord('page', 1, { adapterOptions: { branch : 'draft' }})
    });
  }
});
