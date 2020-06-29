import Route from '@ember/routing/route';
import VERSION_HISTORY from '../../data/version-history';

export default class MediaRegistryItemRoute extends Route {
  async model({ itemId }) {
    const versionHistory = VERSION_HISTORY.filter(el => el.id === itemId)[0];
    const { id, title, versions } = versionHistory;
    return {
      id,
      title,
      versions
    }
  }
}
