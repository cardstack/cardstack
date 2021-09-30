import { encodeDID } from '@cardstack/did-resolver';
import { getFilenameFromDid } from '../tests/helpers/data';

export default function () {
  this.namespace = 'api';

  this.post('/merchant-infos');

  this.get(
    '/merchant-infos/validate-slug/:slug',
    function ({ merchantInfos }, { params: { slug } }) {
      let merchantBySlug = merchantInfos.findBy({ slug });

      if (merchantBySlug) {
        return {
          slugAvailable: false,
          detail: 'Merchant slug already exists',
        };
      } else {
        return {
          slugAvailable: true,
          detail: 'Merchant slug is available',
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

  this.post('/prepaid-card-customizations', async function (schema) {
    let prepaidCardCustomizationId = '75218c05-3899-46d6-b431-e7237ba293ca';
    let did = encodeDID({
      type: 'PrepaidCardCustomization',
      uniqueId: prepaidCardCustomizationId,
      version: 1,
    });

    let customization = schema.create('prepaid-card-customization', {
      id: await getFilenameFromDid(did),
      did,
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
