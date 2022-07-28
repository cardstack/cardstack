/* global fetch */
import { inject } from '@cardstack/di';

import { getResolver } from '@cardstack/did-resolver';
import { Profile } from '@prisma/client';
import { Resolver } from 'did-resolver';
import { JSONAPIDocument } from '../utils/jsonapi-document';

export type ProfileMerchantSubset = Omit<Profile, 'links' | 'profileImageUrl' | 'profileDescription' | 'createdAt'>;
export default class MerchantInfoService {
  #didResolver = new Resolver(getResolver());

  merchantInfoSerializer = inject('merchant-info-serializer', {
    as: 'merchantInfoSerializer',
  });

  async getMerchantInfo(did?: string): Promise<Profile | ProfileMerchantSubset | null> {
    if (!did) {
      return null;
    }

    try {
      let merchantInfo = await this.fetchMerchantInfo(did);
      return this.merchantInfoSerializer.deserialize(merchantInfo);
    } catch (e) {
      return null;
    }
  }

  async fetchMerchantInfo(did: string): Promise<JSONAPIDocument> {
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
