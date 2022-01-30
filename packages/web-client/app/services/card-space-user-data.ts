import Service from '@ember/service';
import { tracked } from '@glimmer/tracking';

export interface ICardSpaceUserData {
  currentUserData: {
    id: string;
    url?: string;
    profileName?: string;
    profileDescription?: string;
    profileCategory?: string;
    profileButtonText?: string;
    profileImageUrl?: string;
    profileCoverImageUrl?: string;
    bioTitle?: string;
    bioDescription?: string;
    links?: any[];
    donationTitle?: string;
    donationDescription?: string;
    donationSuggestionAmount1?: number;
    donationSuggestionAmount2?: number;
    donationSuggestionAmount3?: number;
    donationSuggestionAmount4?: number;
    ownerAddress?: string;
    merchantId?: string;
  };
}
export default class CardSpaceUserData extends Service {
  @tracked currentUserData = {
    id: 'id',
    url: '2acmichael.card.space',
    profileName: 'profileName',
    profileDescription: 'profileDescription',
    profileCategory: 'profileCategory',
    profileButtonText: 'profileButtonText',
    profileImageUrl: '',
    profileCoverImageUrl: '',
    bioTitle: 'bioTitle',
    bioDescription: 'bioDescription',
    links: [],
    donationTitle: 'donationTitle',
    donationDescription: 'donationDescription',
    donationSuggestionAmount1: 100,
    donationSuggestionAmount2: 200,
    donationSuggestionAmount3: 300,
    donationSuggestionAmount4: 400,
    ownerAddress: 'ownerAddress',
    merchantId: '2acmichael',
  };

  async put(data: any) {
    console.log('sending data', data);
    await new Promise<void>((resolve) => setTimeout(resolve, 1000));
    for (let key in data) {
      // @ts-ignore
      this.currentUserData[key] = data[key];
      // eslint-disable-next-line no-self-assign
      this.currentUserData = this.currentUserData;
    }
  }
}

// DO NOT DELETE: this is how TypeScript knows how to look up your services.
declare module '@ember/service' {
  interface Registry {
    'card-space-user-data': CardSpaceUserData;
  }
}
