/* global fetch */
import { inject } from '@cardstack/di';

import { getResolver } from '@cardstack/did-resolver';
import { Resolver } from 'did-resolver';

export default class MerchantInfoService {
  // @ts-ignore FIXME what is with this?!?!
  #didResolver = new Resolver(getResolver().cardstack);

  merchantInfoSerializer = inject('merchant-info-serializer', {
    as: 'merchantInfoSerializer',
  });

  async getMerchantInfo(did: string): Promise<any> {
    let merchantInfo = await this.fetchMerchantInfo(did);
    return this.merchantInfoSerializer.deserialize(merchantInfo);
  }

  async fetchMerchantInfo(did: string): Promise<any> {
    let didResult = await this.#didResolver.resolve(did);
    let alsoKnownAs = didResult?.didDocument?.alsoKnownAs;

    return await (await fetch(alsoKnownAs![0])).json();
  }
}

declare module '@cardstack/di' {
  interface KnownServices {
    'merchant-info': MerchantInfoService;
  }
}
