import { AddressableCard, CardId } from './card';
import { SingleResourceDoc } from 'jsonapi-typescript';

export interface CardInstantiator {
  instantiate(jsonapi: SingleResourceDoc, imposeIdentity?: CardId): Promise<AddressableCard>;
}
