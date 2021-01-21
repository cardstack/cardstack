import Route from '@ember/routing/route';
import { fetchCollection } from '@cardstack/boxel/media';
import { titleize } from '@cardstack/boxel/utils/titleize';

export default class MediaRegistryItemRoute extends Route {
  titleToken(model) {
    return `${titleize(model.title)} (Master Recording)`;
  }

  async model({ itemId }, transition) {
    const records = await fetchCollection('all_tracks_combined');
    const profiles = await fetchCollection('profiles');
    const musicalWorks = await fetchCollection('musical-works');
    const collections = await fetchCollection('collections');

    let { currentOrg } = this.modelFor('media-registry');
    let { id } = currentOrg;

    let record = records.find(
      (item) => item.owner_id === id && item.id === itemId && !item.version
    );
    if (!record) {
      return;
    }

    record.currentOrg = currentOrg;

    if (record.artist_id) {
      const artists = profiles.filter((el) => el.id === record.artist_id);
      record.artists = artists;
    }

    if (record.producer_id) {
      const producers = profiles.filter((el) => el.id === record.producer_id);
      record.producers = producers;
    }

    if (record.iswc_id) {
      const work = musicalWorks.find(
        (el) => el.owner_id === id && el.iswc === record.iswc_id && !el.version
      );
      record.musicalWork = work;
    }

    if (record.collection_ids) {
      const catalogs = collections.filter((el) =>
        record.collection_ids.includes(el.id)
      );
      record.collections = catalogs;
    }

    if (transition && transition?.from?.parent?.params?.collectionId) {
      record.fromCollectionId = transition.from.parent.params.collectionId;
    }

    record.selectableArtists = profiles;
    record.selectableWorks = musicalWorks;

    return record;
  }
}
