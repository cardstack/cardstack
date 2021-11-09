import { expect } from 'chai';
import { Project } from 'scenario-tester';

if (process.env.COMPILER) {
  // TODO: Move to card-routes test of some sort
  describe.skip('Server boot', function () {
    it('Errors if configured routing card does not have routeTo methods', async function () {
      let realm = new Project('my-realm', {
        files: {
          routes: {
            'card.json': JSON.stringify({
              schema: 'schema.js',
            }),
            'schema.js': `
              export default class Routes {
                goToThisCardPLS(path) {
                  if (path === 'homepage') {
                    return 'https://my-realm/welcome';
                  }

                  if (path === 'about') {
                    return 'https://my-realm/about';
                  }
                }
              }
            `,
          },
        },
      });
      realm.writeSync();

      // expect(
      //   HubServer.create({
      //     routeCard: 'https://my-realm/routes',
      //   })
      // ).to.be.rejectedWith(/Route Card's Schema does not have proper routing method defined/);
      expect(false).to.be.rejectedWith(/Route Card's Schema does not have proper routing method defined/);
    });
  });
}
