import Cardbot from '../images/icons/cardbot-lg.svg';
import GaryWalkerThumb from '../images/workflow/participants/thumb/Gary-Walker.jpg';

export default {
  "bots": [
    {
      "id": "cardbot",
      "title": "Cardbot",
      "imgURL": Cardbot
    }
  ],
  "orgs": [],
  "users": [
    {
      "id": "gary-walker",
      "title": "Gary Walker",
      "imgURL": GaryWalkerThumb,
      "accounts": [
        {
          "id": "1",
          "title": "Personal Account",
          "no": "0x59cd...4Fa3"
        },
        {
          "id": "2",
          "title": "EMMA Account",
          "no": "0x1F2b...35Da"
        },
        {
          "id": "2",
          "title": "Self-Publishing Writers Account",
          "no": "0x4E6b...35eb"
        }
      ],
      "workflows": [
        {
          "id": "1",
          "workflowId": "prepaid-card-issuance",
          "accountId": "1"
        },
        {
          "id": "2",
          "workflowId": "reserve-pool-deposit",
          "accountId": "1"
        },
        {
          "id": "3",
          "workflowId": "prepaid-card-transfer",
          "accountId": "1"
        }
      ]
    },
    {
      "id": "anna-graham",
      "title": "Anna Graham",
      "accounts": [],
      "workflows": []
    }
  ],
  "queueCards": [],
  "messages": [],
  "workflows": [
    {
      "id": "prepaid-card-issuance",
      "title": "Prepaid Card Issuance",
      "workflowRepresentatives": ["cardbot"],
      "milestones": [
        {
          "id": "1",
          "title": "Customize Layout",
          "statusOnCompletion": "Layout customized",
          "sender": Cardbot,
          "message": [
            "Hello, it’s nice to see you!",
            "Let’s issue a Prepaid Card.",
            "First, you can choose the look and feel of your card, so that your customers and other users recognize that this Prepaid Card came from you."
          ],
          "datetime": "2020-03-07T10:11",
          "actionCard": "prepaid-card/layout-customization",
          "delayMs": "2400"
        },
        {
          "id": "2",
          "title": "Choose Face Value",
          "statusOnCompletion": "Face value chosen",
          "sender": Cardbot,
          "message": [
            "Nice choice!",
            "On to the next step: When you choose the face value of your Prepaid Card, you may want to consider creating one card with a larger balance, as opposed to several cards with smaller balances (which would require a separate transaction, incl. fees, for each card). After you have created your card, you can split it up into multiple cards with smaller balances to transfer to your customers."
          ],
          "datetime": "2020-03-07T10:16",
          "actionCard": "prepaid-card/funding",
          "delayMs": "1400"
        },
        {
          "id": "3",
          "title": "Confirm Transaction",
          "statusOnCompletion": "Transaction confirmed",
          "sender": Cardbot,
          "message": [
            "We are ready to submit your transaction to the xDai network via a relayer. The transaction fee for the relay will be added to your payment, but you do not need to acquire the gas token (xDai) in order to complete the transaction."
          ],
          "datetime": "2020-03-07T10:22",
          "messageOnCompletion": [
            "Congratulations, you have created a Prepaid Card! This Prepaid Card has been added to your Layer-2 Wallet."
          ],
          "datetimeOnCompletion": "2020-03-07T10:27"
        }
      ]
    },
    {
      "id": "reserve-pool-deposit",
      "title": "Reserve Pool Deposit",
      "workflowRepresentatives": ["cardbot"],
      "milestones": [
        {
          "id": "1",
          "title": "Connect Layer-1 Wallet",
          "statusOnCompletion": "Layer-1 wallet connected"
        },
        {
          "id": "2",
          "pct": "25",
          "title": "Connect Layer-2 Wallet",
          "statusOnCompletion": "Layer-2 wallet connected"
        },
        {
          "id": "3",
          "pct": "50",
          "title": "Deposit Into Reserve Pool",
          "statusOnCompletion": "Reserve pool deposited"
        },
        {
          "id": "4",
          "pct": "75",
          "title": "Add Balance to Layer-2 Wallet",
          "statusOnCompletion": "Balance added"
        }
      ]
    },
    {
      "id": "prepaid-card-transfer",
      "title": "Prepaid Card Transfer",
      "workflowRepresentatives": ["cardbot"],
      "milestones": [
        {
          "id": "1",
          "title": "Select Card",
          "statusOnCompletion": "Card selected"
        },
        {
          "id": "2",
          "pct": "25",
          "title": "Select Delivery Method",
          "statusOnCompletion": "Delivery method selected"
        },
        {
          "id": "3",
          "pct": "50",
          "title": "Approve Transaction",
          "statusOnCompletion": "Transaction approved"
        },
        {
          "id": "3",
          "pct": "75",
          "title": "Transfer Card",
          "statusOnCompletion": "Card transferred"
        }
      ]
    }
  ]
}
