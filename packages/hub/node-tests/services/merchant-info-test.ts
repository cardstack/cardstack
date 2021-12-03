import MerchantInfoService from '../../services/merchant-info';
import { JSONAPIDocument } from '../../utils/JSONAPIDocument';
import { registry, setupHub } from '../helpers/server';

describe('MerchantInfoService', function () {
  let { getContainer } = setupHub(this);

  it('returns a MerchantInfo object extracted from a fetched document', async function () {
    let mockMerchantInfoDocument = {
      meta: { network: 'sokol' },
      data: {
        id: '05074049-be24-45fe-81ba-8e3c1a623aa7',
        type: 'merchant-infos',
        attributes: {
          did: 'did:cardstack:1m1C1LK4xoVSyybjNRcLB4APbc07954765987f62',
          name: 'a long long long long multi-word name that will cause problems because it is so long it really maybe shouldn’t even be permitted amirite maybe there should be (more of?) a limit',
          slug: 'longlongmultiword',
          color: '#fff700',
          'text-color': '#000000',
          'owner-address': '0x323B2318F35c6b31113342830204335Dac715AA8',
        },
      },
    };

    class PatchedMerchantInfoService extends MerchantInfoService {
      async fetchMerchantInfo(): Promise<JSONAPIDocument> {
        return mockMerchantInfoDocument;
      }
    }

    registry(this).register('merchant-info', PatchedMerchantInfoService);

    let subject = await getContainer().lookup('merchant-info');
    let result = await subject.getMerchantInfo('did:cardstack:1m1C1LK4xoVSyybjNRcLB4APbc07954765987f62');

    expect(result).deep.equal({
      id: '05074049-be24-45fe-81ba-8e3c1a623aa7',
      name: 'a long long long long multi-word name that will cause problems because it is so long it really maybe shouldn’t even be permitted amirite maybe there should be (more of?) a limit',
      slug: 'longlongmultiword',
      color: '#fff700',
      textColor: '#000000',
      ownerAddress: '0x323B2318F35c6b31113342830204335Dac715AA8',
    });
  });
});
