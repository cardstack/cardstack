import { expect } from 'chai';
import { Resolver } from 'did-resolver';
import { encodeDID, parseIdentifier, getResolver } from '../index';
import shortUuid from 'short-uuid';
import { shake_128 } from 'js-sha3';

describe('Cardstack DID Resolver', function () {
  beforeEach(async function () {});

  afterEach(async function () {});

  describe('encoding and decoding method identifier', function () {
    it('it can generate a DID with default version and generated ID', async function () {
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

    it('generates a DID with specified version 5', function () {
      let identifier = encodeDID({ version: 5, type: 'PrepaidCardCustomization' }).split(':')[2];
      expect(identifier).to.match(/^5/);
      expect(parseIdentifier(identifier).version).to.eq(5);
    });

    it('generates a DID with specified version 15', function () {
      let identifier = encodeDID({ version: 15, type: 'PrepaidCardCustomization' }).split(':')[2];
      expect(identifier).to.match(/^F/);
      expect(parseIdentifier(identifier).version).to.eq(15);
    });

    it('generates a DID with specified version 42', function () {
      let identifier = encodeDID({ version: 42, type: 'PrepaidCardCustomization' }).split(':')[2];
      expect(identifier).to.match(/^g/);
      expect(parseIdentifier(identifier).version).to.eq(42);
    });

    it('fails to generate when version is below the valid range', function () {
      try {
        encodeDID({ version: -1, type: 'PrepaidCardCustomization' });
        expect.fail('should throw and not reach here');
      } catch (e) {
        expect(e.message).to.eq('version out of supported range: -1');
      }
    });

    it('fails to generate when version is above the valid range', function () {
      try {
        encodeDID({ version: 62, type: 'PrepaidCardCustomization' });
        expect.fail('should throw and not reach here');
      } catch (e) {
        expect(e.message).to.eq('version out of supported range: 62');
      }
    });

    it('generates for all valid versions', function () {
      for (let version = 0; version < 62; version++) {
        encodeDID({ version, type: 'PrepaidCardCustomization' });
      }
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
      } catch (e) {
        expect(e.message).to.eq('Invalid DID identifier: checksum failed');
      }
    });
    it('fails to parse with invalid type', async function () {
      let did = `1Z${shortUuid.generate()}`;
      did = `did:cardstack:${did}${shake_128(did, 64)}`;
      try {
        await resolver.resolve(did);
        expect.fail('should throw and not reach here');
      } catch (e) {
        expect(e.message).to.eq('Invalid DID identifier: unknown type "Z"');
      }
    });
  });
});
