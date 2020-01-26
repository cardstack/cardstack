import { CardId, AddressableCard } from './card';

export interface CardReader {
  get(id: CardId): Promise<AddressableCard>;
  get(canonicalURL: string): Promise<AddressableCard>;
}
