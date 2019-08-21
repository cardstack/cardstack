import Route from '@ember/routing/route';
import { inject as service } from '@ember/service';

export default class ToolsEditRoute extends Route {
  @service boxel;

  model({ model, id }) {
    if (!id || id === 'sample') {
      let { title, description, body, imageUrl, author } = this.store.peekRecord(model, 'sample');
      return this.store.createRecord(model, {
        title,
        description,
        body,
        imageUrl,
        author,
        publishedDate: new Date()
      });
    }

    return this.store.peekRecord(model, id);
  }
}
