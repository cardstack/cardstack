import BoxelizedRoute from 'boxel/routes/boxelized';

export default class CardsRoute extends BoxelizedRoute {
  boxelPlane = 'space';

  async model() {
    return this.store.findRecord('article', 'sample');
    // return {
    //   id : "1",
    //   title: 'Rethinking the Web 3.0 Experience',
    //   description: 'What would improve the Web beyond “decentralization”?',
    //   body: 'For many of us who have already played with blockchains, there’s a deep belief that Web 3.0, or “the decentralized Internet,” is primarily a network of value, with trustless, verifiable transactions for digital assets, synchronized around global ledgers.'
    // };
  }
}
