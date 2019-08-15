import DS from 'ember-data';

export default class ApplicationAdapter extends DS.JSONAPIAdapter {
  namespace = 'api';
}