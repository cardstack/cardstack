import Route from '@ember/routing/route';
// NOTE: This import should eventually be replaced by fetch to
// mirage data
import dbCardPay from 'dummy/data/db-card-pay';
import CardstackLogo from '../../../../public/@cardstack/boxel/images/icons/cardstack-logo.svg';

// assuming this user has started a session
const USER_ID = 'gary-walker';

export default class CardPayRoute extends Route {
  userId = USER_ID;

  async model() {
    let { users, bots, messages, workflows } = dbCardPay;

    let user = users.find((el) => el.id === this.userId);

    return {
      title: 'Card Pay',
      logo: CardstackLogo,
      user,
      users,
      bots,
      messages,
      workflows,
    };
  }
}
