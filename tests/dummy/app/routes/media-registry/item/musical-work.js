import Route from '@ember/routing/route';
import { fetchCollection } from 'dummy/media';

export default class MediaRegistryItemMusicalWorkRoute extends Route {
  async model() {
    const profiles = await fetchCollection('profiles');
    let model = this.modelFor('media-registry.item');

    // if (!model.musicalWork) { return; }

    let { musicalWork } = model;
    if (musicalWork) {
      musicalWork.lyricists = profiles.filter(profile => profile.id === musicalWork.artist_id);
      musicalWork.composers = profiles.filter(profile => profile.id === musicalWork.composer_id);
    } else {
      musicalWork = model;
    }

    return musicalWork;
  }
}
