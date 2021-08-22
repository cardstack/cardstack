import { https } from 'firebase-functions';

const MAINTENANCE_ACTIVE = false;
const MAINTENANCE_MESSAGE = 'Card Wallet is going through scheduled maintenance, please try again later.';

exports.maintenanceStatus = https.onRequest(async (_, res) => {
  res.status(200).json({
    maintenanceActive: MAINTENANCE_ACTIVE,
    maintenanceMessage: MAINTENANCE_MESSAGE,
  });
});
