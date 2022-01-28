import Service from '@ember/service';
import { tracked } from '@glimmer/tracking';

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

  async post(data: any) {
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
