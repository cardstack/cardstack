import Route from '@ember/routing/route';
import { fetchCollection } from '@cardstack/boxel/media';
import { titleize } from '@cardstack/boxel/utils/titleize';

export default class MediaRegistryItemMusicalWorkRoute extends Route {
  titleToken(model) {
    return `${titleize(model.title)} (${titleize(model.type)})`;
  }

  async model() {
    const profiles = await fetchCollection('profiles');
    let model = this.modelFor('media-registry.item');

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
