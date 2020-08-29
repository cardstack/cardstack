import Route from '@ember/routing/route';
import DISCREPANCIES from 'dummy/data/discrepancies-list';

export default class MediaRegistryDiscrepanciesIndexRoute extends Route {
  model() {
    let { currentOrg, orgs } = this.modelFor('media-registry');
    let { id } = currentOrg;
    let discrepancies = DISCREPANCIES.filter(el => el.ownerId === id);

    return {
      id,
      currentOrg,
      orgs,
      title: 'All Discrepancies',
      type: 'list',
      collection: discrepancies,
      listTitleFields: [
        'Title',
        'Type',
        'Version',
        'Other Version'
      ],
      listFields: [
        {
          valuePath: 'title'
        },
        {
          valuePath: 'type'
        },
        {
          valuePath: 'baseOwner'
        },
        {
          valuePath: 'compOwner'
        },
      ],
      columns: [
        {
          name: 'Title',
          valuePath: 'title'
        },
        {
          name: 'Type',
          valuePath: 'type'
        },
        {
          name: 'Version',
          valuePath: 'baseOwner'
        },
        {
          name: 'Other Version',
          valuePath: 'compOwner'
        },
      ],
    };
  }
}
