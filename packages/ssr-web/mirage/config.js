import { nativeCurrencies } from '@cardstack/cardpay-sdk';
import config from '@cardstack/ssr-web/config/environment';

export default function () {
  this.namespace = 'api';

  // FIXME ugh!! should not need a host
  this.get(
    'http://localhost:3000/api/card-spaces/:slug',
    (schema, { params: { slug } }) => {
      return schema.cardSpaces.where({ slug }).models[0];
    }
  );

  this.get('/exchange-rates', function () {
    return {
      data: {
        type: 'exchange-rates',
        attributes: {
          base: 'USD',
          rates: Object.fromEntries(
            Object.keys(nativeCurrencies).map((k) => [k, 2])
          ),
        },
      },
    };
  });

  this.get(
    'https://storage.cardstack.com/merchant-info/:idWithExtension',
    function (schema, { params: { idWithExtension } }) {
      let [id] = idWithExtension.split('.');
      return schema.merchantInfos.find(id);
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
