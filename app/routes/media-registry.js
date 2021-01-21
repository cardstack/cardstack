import Route from '@ember/routing/route';
import ORGS from '@cardstack/boxel/data/organizations';

import '@cardstack/boxel/css/templates/media-registry.css';
import '@cardstack/boxel/css/templates/media-registry/master-collection.css';
import '@cardstack/boxel/css/templates/media-registry/collection.css';
import '@cardstack/boxel/css/templates/media-registry/item.css';
import '@cardstack/boxel/css/templates/media-registry/item-edit.css';
import '@cardstack/boxel/css/templates/media-registry/agreements.css';
import '@cardstack/boxel/css/templates/media-registry/embedded-collection-table.css';
import '@cardstack/boxel/css/templates/media-registry/discrepancies-index.css';
import '@cardstack/boxel/css/templates/media-registry/discrepancy.css';

export default class MediaRegistryRoute extends Route {
  defaultGroup = [ 'bunny_records', 'crd_records' ];
  verifiGroup = [ 'warner-music-group', 'allegro-music-publishing', 'warner-chappell-music', 'global-music-rights', 'deezer'];

  titleToken(model) {
    return `${model.currentOrg.title}`;
  }

  model({ orgId }) {
    let orgGroup;
    let currentOrg;

    if (this.verifiGroup.includes(orgId)) {
      orgGroup = this.verifiGroup;
    } else {
      orgGroup = this.defaultGroup;
    }

    let orgs = orgGroup.map(id => ORGS.find(el => {
      if (el.id === orgId) {
        currentOrg = el;
      }
      return el.id === id;
    }));

    return {
      orgs,
      currentOrg
    }
  }
}
