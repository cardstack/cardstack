import Route from '@ember/routing/route';
import { fetchCollection } from 'dummy/media';

const DEFAULT_LABEL = 'bunny_records';

const ORGS = [
  {
    id: 'bunny_records',
    company: 'Bunny Records',
    iconURL: "/media-registry/button-bunny-records.svg",
    logoURL: '/media-registry/bunny-logo.svg'
  },
  {
    id: 'crd_records',
    company: 'CRD Records',
    iconURL: "/media-registry/button-crd-records.svg",
    logoURL: '/media-registry/crd_records_logo.svg'
  }
];

export default class MediaRegistryRoute extends Route {
  orgs = ORGS;

  async model({ id }) {
    if (id !== DEFAULT_LABEL && id !== 'crd_records') {
      id = DEFAULT_LABEL;
    }
    let collection = await fetchCollection(`${id}_collections`);
    let masterData = this.orgs.filter(el => el.id === id)[0];

    return {
      title: 'Master Recordings',
      type: 'master-collection',
      id: masterData.id,
      logoURL: masterData.logoURL,
      company: masterData.company,
      collection,
      orgs: this.orgs,
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
          name: 'Masters',
          valuePath: 'number_of_songs',
          width: 250,
          isSortable: false
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
