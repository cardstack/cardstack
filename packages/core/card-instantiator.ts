import { AddressableCard } from '@cardstack/hub';
import { CardId } from './card-id';
import { SingleResourceDoc } from 'jsonapi-typescript';

export interface CardInstantiator {
  instantiate(jsonapi: SingleResourceDoc, imposeIdentity?: CardId): Promise<AddressableCard>;
}
