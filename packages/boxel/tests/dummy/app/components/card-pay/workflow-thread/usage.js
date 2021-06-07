import Component from '@glimmer/component';
import CardbotIcon from '@cardstack/boxel/usage-support/images/orgs/cardbot.svg';
import GaryImage from '@cardstack/boxel/usage-support/images/users/Gary-Walker.jpg';

const ACCOUNT_HOLDER = {
  title: 'Gary Walker',
  imgURL: GaryImage,
};

const WORKFLOW_BOT = {
  title: 'Cardbot',
  imgURL: CardbotIcon,
};

const MILESTONES = [
  {
    title: 'Customize Layout',
    statusOnCompletion: 'Layout customized',
    message: [
      'Hello, it’s nice to see you!',
      'Let’s issue a Prepaid Card.',
      'First, you can choose the look and feel of your card, so that your customers and other users recognize that this Prepaid Card came from you.',
      {
        component: 'boxel/action-container',
      },
    ],
    datetime: '2020-03-07T10:11',
    actionCard: 'card-pay/prepaid-card-issuance/layout-customization-card',
  },
  {
    title: 'Choose Face Value',
    statusOnCompletion: 'Face value chosen',
    message: [
      'Nice choice!',
      'On to the next step: When you choose the face value of your Prepaid Card, you may want to consider creating one card with a larger balance, as opposed to several cards with smaller balances (which would require a separate transaction, incl. fees, for each card). After you have created your card, you can split it up into multiple cards with smaller balances to transfer to your customers.',
      {
        component: 'boxel/action-container',
      },
    ],
    datetime: '2020-03-07T10:16',
  },
  {
    title: 'Confirm Transaction',
    statusOnCompletion: 'Transaction confirmed',
    message: [
      'We are ready to submit your transaction to the xDai network via a relayer. The transaction fee for the relay will be added to your payment, but you do not need to acquire the gas token (xDai) in order to complete the transaction.',
      {
        component: 'boxel/action-container',
      },
    ],
    datetime: '2020-03-07T10:22',
    messageOnCompletion: [
      'Congratulations, you have created a Prepaid Card! This Prepaid Card has been added to your Layer-2 Wallet.',
    ],
    datetimeOnCompletion: '2020-03-07T10:27',
  },
];

export default class extends Component {
  accountHolder = ACCOUNT_HOLDER;
  title = 'Prepaid Card Issuance';
  workflowBot = WORKFLOW_BOT;
  milestones = MILESTONES;
}
