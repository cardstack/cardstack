import Route from '@ember/routing/route';

export default class ToolsEditRoute extends Route {
  async model(params) {
    let { title, description, body, imageUrl } = await this.store.findRecord(params.model, 'sample');
    return this.store.createRecord(params.model, {
      title,
      description,
      body,
      imageUrl
    });
  }
}
