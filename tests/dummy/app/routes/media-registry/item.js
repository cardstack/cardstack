import Route from '@ember/routing/route';
import fetch from 'fetch';
import { dasherize } from '@ember/string';

export default class MediaRegistryItemRoute extends Route {
  async model({ itemId }) {
    const data = await fetch('/data/full_catalog_bunny_records_table_1.json');
    const records = await data.json();

    const record = records.filter(item => {
      if (item.catalog) {
        return dasherize(item.song_title) === itemId;
      }
    })[0];

    return record;
  }
}
