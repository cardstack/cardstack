import { ExtendedPrismaClient } from '../../services/prisma-manager';
import { setupHub } from '../helpers/server';

describe('GET /api/prepaid-card-color-schemes', function () {
  let prisma: ExtendedPrismaClient;
  let { getContainer, request } = setupHub(this);

  this.beforeEach(async function () {
    prisma = await (await getContainer().lookup('prisma-manager')).getClient();

    await prisma.prepaid_card_color_schemes.createMany({
      data: [
        {
          id: 'C169F7FE-D83C-426C-805E-DF1D695C30F1',
          background: '#efefef',
          pattern_color: 'black',
          text_color: 'black',
          description: 'Solid Gray',
        },
        {
          id: '5058B874-CE21-4FC4-958C-B6641E1DC175',
          background: 'linear-gradient(139.27deg, #ff5050 16%, #ac00ff 100%)',
          pattern_color: 'white',
          text_color: 'white',
          description: 'Awesome Gradient',
        },
      ],
    });
  });

  it('responds with 200 and available color schemes', async function () {
    await request()
      .get('/api/prepaid-card-color-schemes')
      .set('Accept', 'application/vnd.api+json')
      .expect(200)
      .expect({
        data: [
          {
            type: 'prepaid-card-color-schemes',
            id: 'c169f7fe-d83c-426c-805e-df1d695c30f1',
            attributes: {
              background: '#efefef',
              'pattern-color': 'black',
              'text-color': 'black',
              description: 'Solid Gray',
            },
          },
          {
            type: 'prepaid-card-color-schemes',
            id: '5058b874-ce21-4fc4-958c-b6641e1dc175',
            attributes: {
              background: 'linear-gradient(139.27deg, #ff5050 16%, #ac00ff 100%)',
              'pattern-color': 'white',
              'text-color': 'white',
              description: 'Awesome Gradient',
            },
          },
        ],
      })
      .expect('Content-Type', 'application/vnd.api+json');
  });
});
