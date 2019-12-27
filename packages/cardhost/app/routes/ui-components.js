import Route from '@ember/routing/route';

export default class UIComponentsRoute extends Route {
  // TODO: Return base-card when it has more data
  model() {
    return {
      id: 'local-hub::event',
      name: 'event',
      isDirty: true,
      save: async () => {
        return new Promise(resolve => {
          setTimeout(() => {
            resolve();
          }, 2000);
        });
      },
      isolatedFields: [
        {
          name: 'title',
          label: 'title',
          type: '@cardstack/core-types::string',
          value: 'Ember Meetup',
        },
        {
          name: 'description',
          label: 'description',
          type: '@cardstack/core-types::string',
          value:
            'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Fusce sed scelerisque ex, sed elementum lorem. Phasellus sit amet ipsum in tellus vestibulum tincidunt. Etiam rhoncus, orci quis elementum pulvinar, leo lectus feugiat ligula, vel tincidunt massa elit eu augue. Nulla eget tortor non est ullamcorper egestas eu sit amet justo. Cras consectetur tempor dui, eget finibus orci vestibulum vitae. Vestibulum ante ipsum primis in faucibus orci luctus et ultrices posuere cubilia Curae; Donec faucibus mi sed turpis posuere euismod. Sed leo erat, ultricies non ligula eu, ornare consectetur justo. Donec non orci tellus. Aenean ac nibh imperdiet, sollicitudin risus eu, malesuada ante. Interdum et malesuada fames ac ante ipsum primis in faucibus. Nullam commodo sed lorem posuere lobortis. Nam a condimentum nulla, nec tempor dolor. Fusce tincidunt, mi at viverra cursus, tellus metus consequat massa, nec interdum urna ante non libero.',
        },
        {
          name: 'main-image',
          label: 'image',
          type: '@cardstack/core-types::decorative-image',
          value: 'https://images.unsplash.com/photo-1542296140-47fd7d838e76',
        },
        {
          name: 'datetime',
          label: 'date',
          type: '@cardstack/core-types::date',
          value: '2019-09-26',
        },
      ],

      sampleNameField: {
        name: 'sample-name',
        label: 'name',
        type: '@cardstack/core-types::string',
        value: 'Ember Meetup',
      },

      sampleTitleField: {
        name: 'sample-title',
        label: 'title',
        type: '@cardstack/core-types::string',
        value: 'Ember Meetup',
      },

      sampleDescriptionField: {
        name: 'sample-description',
        label: 'description',
        type: '@cardstack/core-types::string',
        value:
          'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Fusce sed scelerisque ex, sed elementum lorem. Phasellus sit amet ipsum in tellus vestibulum tincidunt. Etiam rhoncus, orci quis elementum pulvinar, leo lectus feugiat ligula, vel tincidunt massa elit eu augue. Nulla eget tortor non est ullamcorper egestas eu sit amet justo. Cras consectetur tempor dui, eget finibus orci vestibulum vitae. Vestibulum ante ipsum primis in faucibus orci luctus et ultrices posuere cubilia Curae; Donec faucibus mi sed turpis posuere euismod. Sed leo erat, ultricies non ligula eu, ornare consectetur justo. Donec non orci tellus. Aenean ac nibh imperdiet, sollicitudin risus eu, malesuada ante. Interdum et malesuada fames ac ante ipsum primis in faucibus. Nullam commodo sed lorem posuere lobortis. Nam a condimentum nulla, nec tempor dolor. Fusce tincidunt, mi at viverra cursus, tellus metus consequat massa, nec interdum urna ante non libero.',
      },

      sampleDateField: {
        name: 'sample-datetime',
        label: 'date',
        type: '@cardstack/core-types::date',
        value: '2019-09-26',
      },

      sampleLocationField: {
        name: 'address',
        label: 'location',
        type: '@cardstack/core-types::string',
        value: 'One World Trade Center',
      },

      sampleImageField: {
        name: 'image',
        label: 'image',
        type: '@cardstack/core-types::decorative-image',
        value: 'https://images.unsplash.com/photo-1542296140-47fd7d838e76',
      },

      countries: [
        { name: 'United States' },
        { name: 'Spain' },
        { name: 'Portugal' },
        { name: 'Russia' },
        { name: 'Latvia' },
        { name: 'Brazil' },
        { name: 'United Kingdom' },
      ],
    };
  }
}
