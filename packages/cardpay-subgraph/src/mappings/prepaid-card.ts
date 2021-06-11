import {
  CreatePrepaidCard,
  GasFeeCollected,
  TransferredPrepaidCard,
} from '../../generated/PrepaidCard/PrepaidCardManager';
import { Account, PrepaidCard } from '../../generated/schema';

export function handleCreatePrepaidCard(event: CreatePrepaidCard): void {}
export function handleGasFeeCollected(event: GasFeeCollected): void {}
export function handleTransfer(event: TransferredPrepaidCard): void {}
