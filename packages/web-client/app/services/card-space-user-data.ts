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
    url: 'example.card.space',
    profileName: 'profileName',
    profileDescription: 'profileDescription',
    profileCategory: 'profileCategory',
    profileButtonText: 'profileButtonText',
    profileImageUrl: '',
    profileCoverImageUrl: '',
    bioTitle: 'a',
    bioDescription: 'b',
    links: [
      {
        title: 'Ya',
        url: 'https://example.com',
      },
    ],
    donationTitle: 'Donate to me',
    donationDescription: '',
    donationSuggestionAmount1: 100,
    donationSuggestionAmount2: 100,
    donationSuggestionAmount3: 100,
    donationSuggestionAmount4: 100,
    ownerAddress: 'ownerAddress',
    merchantId: 'example',
  };

  async put(data: any): Promise<any> {
    await new Promise<void>((resolve) => setTimeout(resolve, 1000));
    if (data.bioTitle) {
      let a = 1;
      if (a) throw new Error('oops');
      return {
        errors: [
          {
            status: '422',
            title: 'Invalid attribute',
            source: {
              pointer: `/data/attributes/donation-suggestion-amount-2`,
            },
            detail: `Max length is ${Math.floor(Math.random() * 99)}`,
          },
          // {
          //   status: '403',
          //   title: 'Invalid attribute',
          //   detail: 'Max length is 50',
          // },
        ],
      };
    }
    for (let key in data) {
      // @ts-ignore
      this.currentUserData[key] = data[key];
      // eslint-disable-next-line no-self-assign
      this.currentUserData = this.currentUserData;
    }

    return {
      data: this.currentUserData,
    };
  }
}

// DO NOT DELETE: this is how TypeScript knows how to look up your services.
declare module '@ember/service' {
  interface Registry {
    'card-space-user-data': CardSpaceUserData;
  }
}
