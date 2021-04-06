import Route from '@ember/routing/route';

// dummy assets for now
const CardstackLogo = '';
const CardSpaceLogo = '';
const CardPayLogo = '';
const CardMembershipLogo = '';
const CardCatalogLogo = '';
const CardSpaceImage = '';
const CardPayImage = '';
const CardCatalogImage = '';
const CardMembershipImage = '';

// import 'dummy/css/templates/cardstack.css';
// import 'dummy/css/templates/card-space/index.css';
// import 'dummy/css/templates/card-space/new.css';

const ORGS = [
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
    cta: 'Open',
    launched: true,
    route: 'index',
  },
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
    subtitle: 'For businesses & crypto enthusiasts',
    description: 'Use this seamless payment system to',
    descriptionList: [
      'supply tokens',
      'issue prepaid cards',
      'manage your online store',
      'earn or distribute rewards',
      'etc.',
    ],
    cta: 'Open',
    launched: true,
    route: 'card-pay',
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
    subtitle: 'For creators, crypto enthusiasts & NFT minting',
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
      logo: CardstackLogo,
      orgs: ORGS,
    };
  }
}
