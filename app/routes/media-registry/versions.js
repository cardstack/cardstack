import Route from '@ember/routing/route';
import { titleize } from '@cardstack/boxel/utils/titleize';
import VERSION_HISTORY from '../../data/version-history';

export default class MediaRegistryItemRoute extends Route {
  titleToken(model) {
    return `${titleize(model.title)} - Versions`;
  }

  async model({ itemId }) {
    const versionHistory = VERSION_HISTORY.filter((el) => el.id === itemId)[0];
    const { id, title, versions } = versionHistory;
    return {
      id,
      title,
      versions,
    };
  }
}
