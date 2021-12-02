import Route from '@ember/routing/route';

// we're using file-loader to get assets since we want webpack to hash them.
// these imports are done this way so that we have a consistent way to import assets
import CardSpaceLogo from '@cardstack/web-client/images/icons/card-space-logo-clear-background.svg';
import CardPayLogo from '@cardstack/web-client/images/icons/card-pay-logo.svg';
import CardMembershipLogo from '@cardstack/web-client/images/icons/card-membership-logo.svg';
import CardCatalogLogo from '@cardstack/web-client/images/icons/card-catalog-logo.svg';

import CardSpaceImage from '@cardstack/web-client/images/illustrations/card-space-illustration.svg';
import CardPayImage from '@cardstack/web-client/images/illustrations/card-pay-illustration.svg';
import CardCatalogImage from '@cardstack/web-client/images/illustrations/card-catalog-illustration.svg';
import CardMembershipImage from '@cardstack/web-client/images/illustrations/card-membership-illustration.svg';

import '../css/cardstack-landing-page.css';

import ENV from '../config/environment';
const { enableCardSpace, enableCardPay } = ENV.features;

const ORGS = [
  {
    sideImage: {
      url: CardPayImage,
      alt: '',
    },
    icon: {
      url: CardPayLogo,
      alt: 'Logo for Card Pay',
    },
    id: 'card-pay',
    name: 'Card Pay',
    subtitle: 'Fast, Cheap, and Easy Payments',
    description: 'Launch this dApp to',
    descriptionList: [
      'Create a business account',
      'Issue a prepaid card',
      'View your wallet balances',
      'Deposit or withdraw tokens',
      'Earn rewards (coming soon)',
    ],
    cta: enableCardPay ? 'Open' : 'Launching soon',
    launched: enableCardPay,
    route: 'card-pay',
  },
  {
    sideImage: {
      url: CardSpaceImage,
      alt: '',
    },
    icon: {
      url: CardSpaceLogo,
      alt: 'Logo for Card Space',
    },
    id: 'card-space',
    name: 'Card Space',
    subtitle: 'For creators & businesses',
    description: 'Set up a private or public space for your',
    descriptionList: [
      'blog',
      'videos',
      'online store',
      'personal profile',
      'etc.',
    ],
    cta: enableCardSpace ? 'Open' : 'Launching soon',
    launched: enableCardSpace,
    route: enableCardSpace ? 'card-space' : 'index',
  },
  {
    sideImage: {
      url: CardCatalogImage,
      alt: '',
    },
    icon: {
      url: CardCatalogLogo,
      alt: 'Logo for Card Catalog',
    },
    id: 'card-catalog',
    name: 'Card Catalog',
    subtitle: 'An open software marketplace for developers & designers',
    description: '',
    descriptionList: null,
    cta: 'Launching soon',
    launched: false,
    route: 'index',
  },
  {
    sideImage: {
      url: CardMembershipImage,
      alt: '',
    },
    icon: {
      url: CardMembershipLogo,
      alt: 'Logo for Card Membership',
    },
    id: 'card-membership',
    name: 'Card Membership',
    subtitle: 'Governance & voting for crypto enthusiasts',
    description: '',
    descriptionList: null,
    cta: 'Launching soon',
    launched: false,
    route: 'index',
  },
];

export default class CardstackRoute extends Route {
  async model() {
    return {
      orgs: ORGS,
    };
  }
}
