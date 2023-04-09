import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { resolveDoc } from '../sdk/utils/general-utils';
import { setupServer } from 'msw/node';
import { rest } from 'msw';

chai.use(chaiAsPromised);

const jsonResponse = {
  '@context': 'https://www.w3.org/ns/did/v1',
  id: 'did:web:test-url',
  verificationMethod: [
    {
      id: 'did:web:example.com#key1',
      type: 'JsonWebKey2020',
      controller: 'did:web:example.com',
      publicKeyJwk: {
        kty: 'RSA',
        n: '<RSA modulus>',
        e: '<RSA public exponent>',
      },
    },
  ],
  authentication: ['did:web:example.com#key1'],
  alsoKnownAs: ['https://test-url/testme'],
  service: [
    {
      id: 'did:web:example.com#resource1',
      type: 'ResourceService',
      serviceEndpoint: 'https://test-url/testme',
    },
  ],
};
const handlers = [
  rest.get('https://test-url/testme', (_req, res, ctx) => {
    return res(ctx.json({ hello: 'world' }));
  }),
  rest.get('https://test-url/testme2', (_req, res, ctx) => {
    return res(ctx.json({ foo: 'bar' }));
  }),
  rest.get('https://test-url/.well-known/did.json', (_req, res, ctx) => {
    return res(ctx.json(jsonResponse));
  }),
  rest.get('https://test-url/subfolder/did.json', (_req, res, ctx) => {
    return res(ctx.json(jsonResponse));
  }),
];

describe('Resolves web did', () => {
  const server = setupServer(...handlers);
  before(() => {
    server.listen();
  });

  afterEach(() => {
    // restore handlers that are updated at runtime.
    // Ensure .use does not affect across test
    server.resetHandlers();
  });

  after(() => {
    server.close();
  });

  it('Resolve at root', async () => {
    let result = await resolveDoc('did:web:test-url');
    chai.expect(result).to.deep.eq({ hello: 'world' });
  });
  it('Resolve using subfolder relative path', async () => {
    let result = await resolveDoc('did:web:test-url:subfolder');
    chai.expect(result).to.deep.eq({ hello: 'world' });
  });
  it('Cannot resolve if web tag not specified', async () => {
    chai.expect(resolveDoc('did:test-url')).to.be.rejectedWith('No alsoKnownAs or service found for DID');
  });
  it('Cannot resolve if .well_known resource does not exist', async () => {
    server.use(
      rest.get('https://test-url/.well-known/did.json', (_req, res, ctx) => {
        return res(ctx.status(404));
      })
    );
    chai.expect(resolveDoc('did:web:test-url')).to.be.rejectedWith('No alsoKnownAs or service found for DID');
  });
  it('Resolver will prioritise service key over alsoKnownAs', async () => {
    const modifiedResponse = {
      ...jsonResponse,
      service: [
        {
          id: 'did:web:example.com#resource1',
          type: 'ResourceService',
          serviceEndpoint: 'https://test-url/testme2',
        },
      ],
    };
    server.use(
      rest.get('https://test-url/.well-known/did.json', (_req, res, ctx) => {
        return res(ctx.json(modifiedResponse));
      }),
      rest.get('https://test-url/subfolder/did.json', (_req, res, ctx) => {
        return res(ctx.json(modifiedResponse));
      })
    );
    let result = await resolveDoc('did:web:test-url');
    chai.expect(result).to.deep.eq({ foo: 'bar' });
  });
});
