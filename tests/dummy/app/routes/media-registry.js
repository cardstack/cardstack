import Route from '@ember/routing/route';
import fetch from 'fetch';

const MASTER_COLLECTIONS = '/media-registry/api/bunny_records_collections.json';

export default class MediaRegistryRoute extends Route {
  async model() {
    const res = await fetch(MASTER_COLLECTIONS);
    const collection = await res.json();

    return {
      title: 'Master Recordings',
      type: 'master-collection',
      logoURL: '/media-registry/bunny-logo.svg',
      company: 'Bunny Records',
      collection,
      columns: [
        {
          name: 'Name',
          valuePath: 'catalog_title',
          isFixed: 'left',
          width: 250,
        },
        {
          name: 'Description',
          valuePath: 'catalog_description',
          width: 250,
        },
        {
          name: 'Songs',
          valuePath: 'number_of_songs',
          width: 250,
        },
        {
          name: 'Top Artists',
          valuePath: 'top_artists',
          width: 250,
        },
        {
          name: 'Date Created',
          valuePath: 'date_created',
          width: 250,
        },
        {
          width: 50,
          isFixed: 'right'
        },
      ],
    };
  }
}
