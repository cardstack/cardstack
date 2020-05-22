import Route from '@ember/routing/route';
import { fetchCollection } from 'dummy/media';

export default class MediaRegistryRoute extends Route {
  async model() {

    const collection = await fetchCollection('bunny_records_collections');

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
          width: 0,
          isFixed: 'right'
        },
      ],
    };
  }
}
