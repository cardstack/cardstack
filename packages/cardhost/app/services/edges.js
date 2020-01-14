import Service, { inject as service } from '@ember/service';

export default class EdgesService extends Service {
  @service cardstackEdges;

  constructor(...args) {
    super(...args);

    // Register items for edges
    this.cardstackEdges.registerTopLevelComponent('cards');
  }
}
