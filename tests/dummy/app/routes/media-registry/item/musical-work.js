import Route from '@ember/routing/route';
import { fetchCollection } from 'dummy/media';

export default class MediaRegistryItemMusicalWorkRoute extends Route {
  async model() {
    const profiles = await fetchCollection('profiles');
    let model = this.modelFor('media-registry.item');

    if (!model.musicalWork) { return; }

    let { musicalWork } = model;
    musicalWork.artistName = profiles.filter(profile => profile.id === musicalWork.artist_id)[0];
    musicalWork.composerName = profiles.filter(profile => profile.id === musicalWork.composer_id)[0];

    return musicalWork;
  }
}
