import { expect } from 'chai';
import { Resolver } from 'did-resolver';
import { encodeDID, parseIdentifier, getResolver } from '../index';
import shortUuid from 'short-uuid';
import { shake_128 } from 'js-sha3';
import * as fc from 'fast-check';

describe('Cardstack DID Resolver', function () {
  beforeEach(async function () {});

  afterEach(async function () {});

  describe('encoding and decoding method identifier', function () {
    it('generates a DID with default version and generated ID', async function () {
      let did = encodeDID({ type: 'PrepaidCardCustomization' });
      expect(did).to.be.a('string');
      expect(did).to.match(/^did:cardstack:/);
      let identifier = did.split(':')[2];
      expect(identifier).to.match(/^1p/);
      let parsed = parseIdentifier(identifier);
      expect(parsed.version).to.eq(1);
      expect(parsed.type).to.eq('PrepaidCardCustomization');
      expect(parsed.uniqueId).to.be.a('string');
    });

    it('generates a DID with a default version and specified short ID', async function () {
      let did = encodeDID({ type: 'PrepaidCardCustomization', uniqueId: 'm5CxFhLyitPEvmkYiEbmBG' });
      expect(did).to.be.a('string');
      expect(did).to.match(/^did:cardstack:/);
      let identifier = did.split(':')[2];
      expect(identifier).to.eq('1pm5CxFhLyitPEvmkYiEbmBG73482b8fd926847e');
      let parsed = parseIdentifier(identifier);
      expect(parsed.version).to.eq(1);
      expect(parsed.type).to.eq('PrepaidCardCustomization');
      expect(parsed.uniqueId).to.eq('m5CxFhLyitPEvmkYiEbmBG');
    });

    it('generates a DID with a default version and specified UUIDv4', async function () {
      let did = encodeDID({ type: 'PrepaidCardCustomization', uniqueId: 'BA44CC48-E0CB-463C-919F-0A78A64EDCC4' });
      expect(did).to.be.a('string');
      expect(did).to.match(/^did:cardstack:/);
      let identifier = did.split(':')[2];
      expect(identifier).to.eq('1pp15ewvJhjjUYdFSzKVkxiEfe431497453ad30c');
      let parsed = parseIdentifier(identifier);
      expect(parsed.version).to.eq(1);
      expect(parsed.type).to.eq('PrepaidCardCustomization');
      expect(parsed.uniqueId).to.eq(shortUuid().fromUUID('BA44CC48-E0CB-463C-919F-0A78A64EDCC4'));
    });

    it('throws with an invalid unique id', async function () {
      try {
        encodeDID({ type: 'PrepaidCardCustomization', uniqueId: 'foo' });
        expect.fail('should throw and not reach here');
      } catch (e: any) {
        expect(e.message).to.eq(`uniqueId must be a flickrBase58 or RFC4122 v4-compliant UUID. Was: "foo"`);
      }
    });

    it('generates for valid versions', function () {
      fc.assert(
        fc.property(
          fc.integer().filter((n) => n >= 0 && n < 62),
          (version) => {
            let identifier = encodeDID({ version, type: 'PrepaidCardCustomization' }).split(':')[2];
            expect(identifier).to.match(/^[0-9a-zA-Z]/);
            expect(parseIdentifier(identifier).version).to.eq(version);
          }
        )
      );
    });

    it('throws for invalid versions', function () {
      fc.assert(
        fc.property(
          fc.integer().filter((n) => n < 0 || n >= 62),
          (version) => {
            try {
              encodeDID({ version, type: 'PrepaidCardCustomization' });
              expect.fail('should throw and not reach here');
            } catch (e: any) {
              expect(e.message).to.eq(`version out of supported range: ${version}`);
            }
          }
        )
      );
    });

    it('generates a DID for merchant info', function () {
      let identifier = encodeDID({ type: 'MerchantInfo' }).split(':')[2];
      expect(identifier).to.match(/^1m/);
      expect(parseIdentifier(identifier).type).to.eq('MerchantInfo');
    });

    it('generates a DID for supplier info', function () {
      let identifier = encodeDID({ type: 'SupplierInfo' }).split(':')[2];
      expect(identifier).to.match(/^1s/);
      expect(parseIdentifier(identifier).type).to.eq('SupplierInfo');
    });
  });

  describe('resolver', function () {
    let resolver: Resolver;
    this.beforeEach(function () {
      resolver = new Resolver({
        ...getResolver(),
      });
    });
    it('returns a DIDDocument for a PrepaidCardCustomization', async function () {
      let uniqueId = shortUuid.generate();
      let did = encodeDID({ type: 'PrepaidCardCustomization', version: 10, uniqueId });
      let result = await resolver.resolve(did);
      expect(result.didDocument?.alsoKnownAs![0]).to.eq(
        `https://storage.cardstack.com/prepaid-card-customization/${uniqueId}.json`
      );
    });
    it('returns a DIDDocument for a MerchantInfo', async function () {
      let uniqueId = shortUuid.generate();
      let did = encodeDID({ type: 'MerchantInfo', version: 30, uniqueId });
      let result = await resolver.resolve(did);
      expect(result.didDocument?.alsoKnownAs![0]).to.eq(`https://storage.cardstack.com/merchant-info/${uniqueId}.json`);
    });
    it('returns a DIDDocument for a SupplierInfo', async function () {
      let uniqueId = shortUuid.generate();
      let did = encodeDID({ type: 'SupplierInfo', version: 5, uniqueId });
      let result = await resolver.resolve(did);
      expect(result.didDocument?.alsoKnownAs![0]).to.eq(`https://storage.cardstack.com/supplier-info/${uniqueId}.json`);
    });
    it('fails to parse with invalid checksum', async function () {
      let did = encodeDID({ type: 'SupplierInfo' });
      did = `${did}a`;
      try {
        await resolver.resolve(did);
        expect.fail('should throw and not reach here');
      } catch (e: any) {
        expect(e.message).to.eq('Invalid DID identifier: checksum failed');
      }
    });
    it('fails to parse with invalid type', async function () {
      let did = `1Z${shortUuid.generate()}`;
      did = `did:cardstack:${did}${shake_128(did, 64)}`;
      try {
        await resolver.resolve(did);
        expect.fail('should throw and not reach here');
      } catch (e: any) {
        expect(e.message).to.eq('Invalid DID identifier: unknown type "Z"');
      }
    });
  });
});
