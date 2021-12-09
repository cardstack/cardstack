export function generateContractEventNotificationId(identifiers: {
  transactionHash: string;
  pushClientId: string;
  ownerAddress: string;
  network: string;
}) {
  return [identifiers.network, identifiers.transactionHash, identifiers.pushClientId, identifiers.ownerAddress].join(
    '-'
  );
}
