import Route from '@ember/routing/route';
import MUSICAL_WORKS from '../../../data/musical-works';

export default class MediaRegistryMusicalWorksWorkRoute extends Route {
  async model({ workId }) {
    return MUSICAL_WORKS.find(el => el.id === workId);
  }
}
