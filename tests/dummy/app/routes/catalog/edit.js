import Route from '@ember/routing/route';

export default class EditRoute extends Route {
  model(params) {
    let { title, description, body, imageUrl } = this.store.peekRecord(params.model, 'sample');
    return this.store.createRecord(params.model, {
      title,
      description,
      body,
      imageUrl
    });
  }
}
