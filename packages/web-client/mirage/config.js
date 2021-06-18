export default function () {
  this.namespace = 'api';

  this.get('/prepaid-card-color-schemes', (schema) => {
    return schema.prepaidCardColorSchemes.all();
  });

  this.get('/prepaid-card-patterns', (schema) => {
    return schema.prepaidCardPatterns.all();
  });

  this.passthrough((request) => {
    return (
      !request.url.includes('/api/prepaid-card-color-schemes') &&
      !request.url.includes('/api/prepaid-card-patterns')
    );
  });
}
