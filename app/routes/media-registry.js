import Route from '@ember/routing/route';
import ORGS from '@cardstack/boxel/data/organizations';

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
