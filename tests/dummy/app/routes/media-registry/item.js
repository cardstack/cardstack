import Route from '@ember/routing/route';
import { formatId } from '@cardstack/boxel/utils/format-id';
import { fetchCollection } from 'dummy/media';

export default class MediaRegistryItemRoute extends Route {
  async model({ itemId }, transition) {
    const records = await fetchCollection('all_tracks_combined');
    const recordDetails = await fetchCollection('songs_by_pia_midina_bb_clarke_table_1');
    const profiles = await fetchCollection('profiles');
    const musicalWorks = await fetchCollection('musical-works');

    const record = records.find(item => {
      if (item.catalog) {
        return formatId(item.song_title) === itemId;
      }
    });

    const recordDetail = recordDetails.find(item => formatId(item.song_title) === itemId);
    const artists = profiles.filter(profile => profile.id === formatId(record.artist));

    if (artists.length) {
      record.artist_info = artists;
    }

    if (recordDetail) {
      const producers = profiles.filter(profile => (profile.id === recordDetail.producer_id));
      const musicalWork = musicalWorks.find(item => item.iswc === recordDetail.iswc_id);
      if (producers.length) {
        record.producer = producers;
      }
      record.details = recordDetail;
      record.musicalWork = musicalWork;
    }

    if (transition && transition?.from?.parent?.params?.collectionId) {
      record.fromCollectionId = transition.from.parent.params.collectionId;
    }

    record.selectableArtists = profiles;

    return record;
  }
}
