import { CardId, AddressableCard } from '@cardstack/core/lib/card';

export interface CardReader {
  get(id: CardId): Promise<AddressableCard>;
  get(canonicalURL: string): Promise<AddressableCard>;
}
