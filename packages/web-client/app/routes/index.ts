import Route from '@ember/routing/route';

// we're using file-loader to get assets since we want webpack to hash them.
// these imports are done this way so that we have a consistent way to import assets
const CardSpaceLogo =
  '@cardstack/web-client/images/icons/card-space-logo-clear-background.svg';
const CardPayLogo = '@cardstack/web-client/images/icons/card-pay-logo.svg';
const CardMembershipLogo =
  '@cardstack/web-client/images/icons/card-membership-logo.svg';
const CardCatalogLogo =
  '@cardstack/web-client/images/icons/card-catalog-logo.svg';

const CardSpaceImage =
  '@cardstack/web-client/images/illustrations/card-space-illustration.svg';
const CardPayImage =
  '@cardstack/web-client/images/illustrations/card-pay-illustration.svg';
const CardCatalogImage =
  '@cardstack/web-client/images/illustrations/card-catalog-illustration.svg';
const CardMembershipImage =
  '@cardstack/web-client/images/illustrations/card-membership-illustration.svg';
const CardSpaceHor =
  '@cardstack/web-client/images/illustrations/card-space-illustration-horizontal.svg';
const CardPayHor =
  '@cardstack/web-client/images/illustrations/card-pay-illustration-horizontal.svg';
const CardCatalogHor =
  '@cardstack/web-client/images/illustrations/card-catalog-illustration-horizontal.svg';
const CardMembershipHor =
  '@cardstack/web-client/images/illustrations/card-membership-illustration-horizontal.svg';

import '../css/cardstack-landing-page.css';

import ENV from '../config/environment';
const { enableCardSpace, enableCardPay } = ENV.features;

const ORGS = [
  {
    sideImage: CardPayImage,
    topImage: CardPayHor,
    icon: {
      url: CardPayLogo,
      alt: 'Logo for Card Pay',
    },
    id: 'card-pay',
    name: 'Card Pay',
    subtitle: 'Fast, cheap & easy payments',
    description: 'Launch this dApp to',
    descriptionList: [
      'Create a business account',
      'Issue prepaid cards',
      'View your wallet balances',
      'Deposit or withdraw tokens',
      'Earn rewards (coming soon)',
    ],
    cta: enableCardPay ? 'Open' : 'Launching soon',
    launched: enableCardPay,
    route: 'card-pay',
  },
  {
    sideImage: CardSpaceImage,
    topImage: CardSpaceHor,
    icon: {
      url: CardSpaceLogo,
      alt: 'Logo for Card Space',
    },
    id: 'card-space',
    name: 'Card Space',
    subtitle: 'Spaces for creators & businesses',
    description: 'Create a space to',
    descriptionList: [
      'Reserve your unique URL',
      'Set up an online store',
      'Build a personal profile',
      'Request donations',
      'Embed features from Card Catalog',
    ],
    cta: enableCardSpace ? 'Open' : 'Launching soon',
    launched: enableCardSpace,
    route: enableCardSpace ? 'card-space' : 'index',
  },
  {
    sideImage: CardCatalogImage,
    topImage: CardCatalogHor,
    icon: {
      url: CardCatalogLogo,
      alt: 'Logo for Card Catalog',
    },
    id: 'card-catalog',
    name: 'Card Catalog',
    subtitle: 'An open software marketplace',
    description: 'Use the catalog to',
    descriptionList: [
      'Submit ideas for new dApps',
      'Fund devs to build new features',
      'Vote to approve / reject submissions',
      'Purchase new cards with Card Pay',
      'Receive grants and earnings as devs',
    ],
    cta: 'Launching soon',
    launched: false,
    route: 'index',
  },
  {
    sideImage: CardMembershipImage,
    topImage: CardMembershipHor,
    icon: {
      url: CardMembershipLogo,
      alt: 'Logo for Card Membership',
    },
    id: 'card-membership',
    name: 'Card Membership',
    subtitle: 'Memberships for DAOs, brands & NFT communities',
    description: 'Set up a membership program to',
    descriptionList: [
      'Engage your users',
      'Create special offers & rewards',
      'Provide a DAO wallet',
      'Bridge on-chain & in real life',
      'Manage recurring subscriptions',
    ],
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
