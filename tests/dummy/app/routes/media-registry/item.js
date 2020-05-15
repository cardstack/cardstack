import Route from '@ember/routing/route';
import { dasherize } from '@ember/string';
import { fetchCollection } from 'dummy/media';

export default class MediaRegistryItemRoute extends Route {
  async model({ itemId }) {
    const records = await fetchCollection('bunny_records_tracks');

    const record = records.filter(item => {
      if (item.catalog) {
        return dasherize(item.song_title.trim()) === itemId;
      }
    })[0];

    return record;
  }
}
