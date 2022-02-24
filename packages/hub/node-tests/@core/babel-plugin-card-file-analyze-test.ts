import cardAnalyze, { ExportMeta } from '@cardstack/core/src/babel-plugin-card-file-analyze';

if (process.env.COMPILER) {
  describe('BabelPluginCardAnalyze', function () {
    it('Returns empty meta information when there is nothing of note in the file', function () {
      let options = {};
      let source = `function serializer() {}`;
      let out = cardAnalyze(source, options);
      expect(out).to.have.property('ast');
      expect(out.code).to.equal(source);
      expect(out.meta).to.deep.equal({});
    });

    it('It captures meta information about exports in the file', function () {
      let options = {};
      let source = `
        export function serializer() {}
        export default class FancyClass {}
        export const KEEP = 'ME AROUND';
      `;
      let out = cardAnalyze(source, options);
      expect(out.code).to.containsSource(source);
      expect(out).to.have.property('ast');
      expect(out.meta).to.have.property('exports');

      let members: ExportMeta[] = [
        { type: 'FunctionDeclaration', name: 'serializer' },
        { type: 'VariableDeclaration', name: 'KEEP' },
        { type: 'ClassDeclaration', name: 'default' },
      ];
      expect(out.meta.exports).to.have.deep.members(members);
    });
  });
}
