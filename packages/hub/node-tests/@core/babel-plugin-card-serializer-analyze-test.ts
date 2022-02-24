import cardSerializerAnalyze from '@cardstack/core/src/babel-plugin-card-serializer-analyze';

if (process.env.COMPILER) {
  describe('BabelPluginCardSerializerAnalyze', function () {
    it('Errors when the serializer does not include any exports', async function () {
      try {
        cardSerializerAnalyze(`function serializer() {}`);
        throw new Error('failed to throw expected exception');
      } catch (err: any) {
        expect(err.message).to.include(
          `Serializer is malformed. It is missing the following exports: serialize, deserialize`
        );
        expect(err.status).to.eq(400);
      }
    });

    it('Errors when the serializer does not include a deserialize method', async function () {
      try {
        cardSerializerAnalyze(`export function serialize() {}`);
        throw new Error('failed to throw expected exception');
      } catch (err: any) {
        expect(err.message).to.include(`Serializer is malformed. It is missing the following exports: deserialize`);
        expect(err.status).to.eq(400);
      }
    });

    it('Errors when the serializer does not include a serialize method', async function () {
      try {
        cardSerializerAnalyze(`export function deserialize() {}`);
        throw new Error('failed to throw expected exception');
      } catch (err: any) {
        expect(err.message).to.include(`Serializer is malformed. It is missing the following exports: serialize`);
        expect(err.status).to.eq(400);
      }
    });
  });
}
