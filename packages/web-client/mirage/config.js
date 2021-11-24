import {
  getFilenameFromDid,
  defaultCreatedPrepaidCardDID,
} from '@cardstack/web-client/utils/test-factories';
import { nativeCurrencies } from '@cardstack/cardpay-sdk';

export default function () {
  this.namespace = 'api';

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

  this.post('/merchant-infos');

  this.get(
    '/merchant-infos/validate-slug/:slug',
    function ({ merchantInfos }, { params: { slug } }) {
      let merchantBySlug = merchantInfos.findBy({ slug });

      if (slug === 'www') {
        return {
          slugAvailable: false,
          detail: 'This Business ID is not allowed',
        };
      } else if (merchantBySlug) {
        return {
          slugAvailable: false,
          detail:
            'This Business ID is already taken. Please choose another one',
        };
      } else {
        return {
          slugAvailable: true,
          detail: 'Business slug is available',
        };
      }
    }
  );

  this.get('/prepaid-card-color-schemes', (schema) => {
    return schema.prepaidCardColorSchemes.all();
  });

  this.get('/prepaid-card-patterns', (schema) => {
    return schema.prepaidCardPatterns.all();
  });

  /**
   * This is hardcoded to create a fixed id.
   */
  this.post('/prepaid-card-customizations', async function (schema) {
    let customization = schema.create('prepaid-card-customization', {
      id: await getFilenameFromDid(defaultCreatedPrepaidCardDID),
      did: defaultCreatedPrepaidCardDID,
      ...this.normalizedRequestAttrs(),
    });

    return customization;
  });

  this.get(
    'https://storage.cardstack.com/prepaid-card-customization/:idWithExtension',
    function (schema, { params: { idWithExtension } }) {
      let [id] = idWithExtension.split('.');
      return schema.prepaidCardCustomizations.find(id);
    }
  );

  this.get(
    'https://storage.cardstack.com/merchant-info/:idWithExtension',
    function (schema, { params: { idWithExtension } }) {
      let [id] = idWithExtension.split('.');
      return schema.merchantInfos.find(id);
    }
  );

  this.passthrough((request) => {
    return (
      !request.url.includes('/api/') &&
      !request.url.includes('storage.cardstack.com')
    );
  });
}
