import Route from '@ember/routing/route';
import ORGS from 'dummy/data/organizations';

import 'dummy/css/templates/media-registry/master-collection.css';
import 'dummy/css/templates/media-registry/collection.css';
import 'dummy/css/templates/media-registry/item.css';
import 'dummy/css/templates/media-registry/item-edit.css';
import 'dummy/css/templates/media-registry/agreements.css';
import 'dummy/css/templates/media-registry/discrepancies.css';

export default class MediaRegistryRoute extends Route {
  titleToken(model) {
    return `${model.currentOrg.title}`;
  }

  model({ orgId }) {
    let currentOrg = ORGS.find((el) => el.id === orgId);

    return {
      orgs: ORGS,
      currentOrg,
    };
  }
}
