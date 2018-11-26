import Controller from '@ember/controller';
import { inject as service } from '@ember/service';
import { pluralize } from 'ember-inflector';
import qs from 'qs';

export default Controller.extend({
  router: service(),

  actions: {
    setParam(paramName, paramValue) {
      let space = this.get('model');
      let allowedParams = space.get('allowedQueryParams');
      if (!allowedParams.includes(paramName)) { return; }

      let type = pluralize(space.get('primaryCard.type'));
      let location = this.get('router.location');
      let currentUrl = location.getURL();
      let params = {};
      let [ path, currentParams ] = currentUrl.split('?');

      if (currentParams) {
        params = qs.parse(currentParams);
      }

      params[type] = params[type] || {};
      params[type][paramName] = paramValue;

      location.setURL(`${path}?${qs.stringify(params, { encodeValuesOnly: true })}`);
    }
  }
});