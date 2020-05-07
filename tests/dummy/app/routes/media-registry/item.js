import Route from '@ember/routing/route';
import fetch from 'fetch';
import { dasherize } from '@ember/string';

const MASTER_TRACKS = '/media-registry/api/bunny_records_tracks.json';

export default class MediaRegistryItemRoute extends Route {
  async model({ itemId }) {
    const data = await fetch(MASTER_TRACKS);
    const records = await data.json();

    const record = records.filter(item => {
      if (item.catalog) {
        return dasherize(item.song_title.trim()) === itemId;
      }
    })[0];

    return record;
  }
}
