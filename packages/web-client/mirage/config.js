import { Response as MirageResponse } from 'ember-cli-mirage';
import * as uuid from 'uuid';
import { encodeDID } from '@cardstack/did-resolver';

export default function () {
  this.namespace = 'api';

  this.get('/prepaid-card-color-schemes', (schema) => {
    return schema.prepaidCardColorSchemes.all();
  });

  this.get('/prepaid-card-patterns', (schema) => {
    return schema.prepaidCardPatterns.all();
  });

  this.post('/prepaid-card-customizations', (_schema, request) => {
    let requestJson = JSON.parse(request.requestBody);
    return new MirageResponse(
      201,
      {
        'Content-Type': 'application/vnd.api+json',
      },
      JSON.stringify({
        data: {
          type: 'prepaid-card-customizations',
          id: uuid.v4(),
          attributes: {
            did: encodeDID({ type: 'PrepaidCardCustomization' }),
            'issuer-name': requestJson.data.attributes['issuer-name'],
            'owner-address': '0x0000000',
          },
          relationships: {
            pattern: {
              data: {
                type: 'prepaid-card-patterns',
                id: requestJson.data.relationships.pattern.data.id,
              },
            },
            'color-scheme': {
              data: {
                type: 'prepaid-card-color-schemes',
                id: requestJson.data.relationships['color-scheme'].data.id,
              },
            },
          },
        },
      })
    );
  });

  this.get(
    'https://storage.cardstack.com/prepaid-card-customization/:id',
    function (schema, { params: { id } }) {
      // FIXME :id includes the .json extension
      return schema.prepaidCardCustomizations.find(id.split('.')[0]);
    }
  );

  this.passthrough((request) => {
    return (
      !request.url.includes('/api/') &&
      !request.url.includes('storage.cardstack.com')
    );
  });
}
