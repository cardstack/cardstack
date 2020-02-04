import { AddressableCard } from './card';
import { CardId } from './card-id';

export interface BatchedIndexUpdate {
  save: (card: AddressableCard) => Promise<void>;
  delete: (id: CardId) => Promise<void>;
  createGeneration: (realm: string) => void;
  deleteOlderGenerations: (realm: string) => Promise<void>;
  done: () => Promise<void>;
}
