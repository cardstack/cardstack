import Route from '@ember/routing/route';
import { fetchCollection } from 'dummy/media';

export default class MediaRegistryIndexRoute extends Route {
  async model() {
    let { currentOrg, orgs } = this.modelFor('media-registry');
    let { id } = currentOrg;

    let allCollections = await fetchCollection('collections');
    let collections = allCollections.filter(el => el.owner_id === id);

    if (collections.length) {
      return {
        id,
        currentOrg,
        orgs,
        title: 'Master Recordings',
        type: 'master-collection',
        itemComponent: 'cards/master-collection',
        itemType: 'collection',
        itemTypePlural: 'collections',
        collection: collections,
        columns: [
          {
            name: 'Name',
            valuePath: 'title',
            isFixed: 'left',
            width: 250,
          },
          {
            name: 'Description',
            valuePath: 'description',
            width: 250,
          },
          {
            name: 'Masters',
            valuePath: 'count',
            width: 250,
            isSortable: false
          },
          {
            name: 'Top Artists',
            valuePath: 'top_titles',
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

    const records = await fetchCollection('all_tracks_combined');
    let tracks = records.filter(item => item.owner_id === id);

    return {
      currentOrg,
      orgs,
      id: 'master-recordings',
      title: 'Master Recordings',
      type: 'collection',
      collection: tracks,
      itemType: 'master',
      itemTypePlural: 'masters',
      itemComponent: 'cards/master-collection-item',
      route: 'media-registry.item',
      listFields: [
        {
          name: 'Release Title',
          valuePath: 'album'
        },
        {
          name: 'Release Type',
          valuePath: 'type_of_album'
        },
        {
          name: 'Genre',
          valuePath: 'genre'
        },
        {
          name: 'Length',
          valuePath: 'length'
        },
      ],
      columns: [
        {
          name: 'Title',
          valuePath: 'title',
          isFixed: 'left',
          width: 350
        },
        {
          name: 'Artist',
          valuePath: 'artist',
          width: 250,
        },
        {
          name: 'Release Title',
          valuePath: 'album',
          width: 250,
        },
        {
          name: 'Artwork',
          valuePath: 'cover_art',
          width: 175,
          isSortable: false,
        },
        {
          name: 'Release Type',
          valuePath: 'type_of_album',
          width: 250,
        },
        {
          name: 'Genre',
          valuePath: 'genre',
          width: 250,
        },
        {
          name: 'Length',
          valuePath: 'length',
          width: 250,
          sortType: 'numeric'
        },
        {
          width: 0,
          isFixed: 'right'
        },
      ],
    };
  }
}
