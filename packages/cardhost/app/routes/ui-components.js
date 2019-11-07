import Route from '@ember/routing/route';

export default class UIComponentsRoute extends Route {
  // TODO: Return base-card when it has more data
  model() {
    return {
      id: 'local-hub::event',
      name: 'event',
      isolatedFields: [
        {
          label: 'title',
          type: 'text',
          value: 'Ember Meetup'
        }
      ]
    }
  }
}
