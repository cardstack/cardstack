import Route from '@ember/routing/route';

export default class ToolsPreviewRoute extends Route {
  model({ model, id }) {
    return this.store.peekRecord(model, id);
  }
}
