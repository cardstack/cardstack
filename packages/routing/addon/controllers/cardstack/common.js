import Controller from '@ember/controller';
import { inject as service } from '@ember/service';
import { pluralize } from 'ember-inflector';
import { some } from 'lodash';
import qs from 'qs';

export default Controller.extend({
  router: service(),

  actions: {
    setParam(paramName, paramValue) {
      let space = this.get('model');
      let allowedParams = space.get('allowedQueryParams');
      if (!allowedParams.includes(paramName)) {
        return;
      }

      let type = pluralize(space.get('primaryCard.type'));
      let location = this.get('router.location');
      let currentUrl = location.getURL();
      let params = {};
      let [path, currentParams] = currentUrl.split('?');

      if (currentParams) {
        params = qs.parse(currentParams);
      }

      if ((paramValue === '' || paramValue === null) && typeof params[type] === 'object') {
        delete params[type][paramName];
      } else {
        params[type] = params[type] || {};
        params[type][paramName] = paramValue;
      }

      let hasParams = some(params, type => typeof type === 'object' && Object.keys(type).length);

      location.setURL(`${path}${hasParams ? '?' : ''}${qs.stringify(params, { encodeValuesOnly: true })}`);
    },
  },
});
