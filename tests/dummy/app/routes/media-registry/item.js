import Route from '@ember/routing/route';
import { dasherize } from '@ember/string';
import { fetchCollection } from 'dummy/media';

export default class MediaRegistryItemRoute extends Route {
  async model({ itemId }, transition) {
    const records = await fetchCollection('all_tracks_combined');
    const recordDetails = await fetchCollection('songs_by_pia_midina_bb_clarke_table_1');
    const profiles = await fetchCollection('profiles');
    const musicalWorks = await fetchCollection('musical-works');
    const versionHistory = await fetchCollection('leaves-version-history');

    const record = records.filter(item => {
      if (item.catalog) {
        return dasherize(item.song_title.trim()) === itemId;
      }
    })[0];

    const recordDetail = recordDetails.filter(item => {
      return dasherize(item.song_title.trim()) === itemId;
    })[0];

    const artist = profiles.filter(profile => {
      return profile.id === dasherize(record.artist.trim());
    })[0];

    if (artist) {
      record.artist_info = artist;
    }

    if (versionHistory) {
      record.versions = versionHistory;
    }

    if (recordDetail) {
      const producer = profiles.filter(profile => (profile.id === recordDetail.producer_id))[0];
      const musicalWork = musicalWorks.filter(item => item.iswc === recordDetail.iswc_id)[0];
      record.producer = producer;
      record.details = recordDetail;
      record.musicalWork = musicalWork;
    }

    if (transition && transition?.from?.parent?.params?.collectionId) {
      record.fromCollectionId = transition.from.parent.params.collectionId;
    }

    return record;
  }
}
