import Route from '@ember/routing/route';
import fetch from 'fetch';
import { dasherize } from '@ember/string';

export default class MediaRegistryCollectionRoute extends Route {
  async model({ collectionId }) {
    const data = await fetch('/data/full_catalog_bunny_records_table_1.json');
    const records = await data.json();
    const collection = records.filter(item => {
      if (item.catalog) {
        let catalogs = item.catalog.split(',');
        return catalogs.map(catalog => dasherize(catalog) === collectionId);
      }
    });
    return {
      title: collectionId,
      type: 'collection',
      collection
    };
  }
}
