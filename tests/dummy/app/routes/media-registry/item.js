import Route from '@ember/routing/route';
import { dasherize } from '@ember/string';
import { fetchCollection } from 'dummy/media';

export default class MediaRegistryItemRoute extends Route {
  async model({ itemId }, transition) {
    const records = await fetchCollection('bunny_records_tracks');
    const recordDetails = await fetchCollection('songs_by_pia_midina_bb_clarke_table_1');
    const profiles = await fetchCollection('profiles');

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

    if (recordDetail) {
      const producer = profiles.filter(profile => {
        return profile.id === dasherize(recordDetail.producer.trim());
      })[0];

      record.producer = producer;
      record.details = recordDetail;
    }

    if (transition && transition?.from?.parent?.params?.collectionId) {
      record.fromCollectionId = transition.from.parent.params.collectionId;
    }

    return record;
  }
}
