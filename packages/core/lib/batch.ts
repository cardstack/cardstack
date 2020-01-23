import { CardId, AddressableCard } from './card';

export interface BatchIndexUpdate {
  save: (card: AddressableCard) => Promise<void>;
  delete: (id: CardId) => Promise<void>;
  createGeneration: (realm: string) => void;
  deleteOlderGenerations: (realm: string) => Promise<void>;
  done: () => Promise<void>;
}
