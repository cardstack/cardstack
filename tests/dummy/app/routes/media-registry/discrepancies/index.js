import Route from '@ember/routing/route';
import DISCREPANCIES from '../../../data/discrepancies-list';

export default class MediaRegistryDiscrepanciesIndexRoute extends Route {
  model() {
    return {
      title: 'All Discrepancies',
      type: 'list',
      id: 'verifi-registry',
      company: 'Verifi Registry',
      typeField: 'type',
      collection: DISCREPANCIES,
      route: 'media-registry.discrepancies.discrepancy',
      listTitleFields: [
        'Title',
        'Type',
        'Version',
        // 'Last Updated',
        'Other Version',
        // 'Last Updated'
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
        // {
        //   valuePath: 'baseCard.datetime',
        //   type: 'date'
        // },
        {
          valuePath: 'compOwner'
        },
        // {
        //   valuePath: 'compCard.datetime',
        //   type: 'date'
        // }
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
