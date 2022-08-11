import config from '@cardstack/ssr-web/config/environment';
import { Response as MirageResponse } from 'ember-cli-mirage';

export default function () {
  this.namespace = 'api';

  this.get('/profiles/:slug', (schema, { params: { slug } }) => {
    let model = schema.profiles.where({ slug }).models[0];

    if (model) {
      return model;
    } else {
      return new MirageResponse(404, {}, 'Not found');
    }
  });

  this.get('/exchange-rates', function (schema, { queryParams: { from, to } }) {
    return {
      data: {
        type: 'exchange-rates',
        attributes: {
          base: from,
          rates: {
            [to]: 2,
          },
        },
      },
    };
  });

  this.get(
    'https://storage.cardstack.com/merchant-info/:idWithExtension',
    function (schema, { params: { idWithExtension } }) {
      let [id] = idWithExtension.split('.');
      return schema.profiles.find(id);
    }
  );

  // prevent sporadic test failure because of degradation banner
  this.get(config.urls.statusPageUrl, function () {
    return {
      incidents: [],
    };
  });

  this.passthrough((request) => {
    return (
      !request.url.startsWith('/upload') &&
      !request.url.includes('/api/') &&
      !request.url.includes('storage.cardstack.com')
    );
  });
}
