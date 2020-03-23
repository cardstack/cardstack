import { AddressableCard } from '@cardstack/hub';
import { CardId } from './card-id';

export interface CardReader {
  get(id: CardId): Promise<AddressableCard>;
  get(canonicalURL: string): Promise<AddressableCard>;
}
