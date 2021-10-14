import { RawCard, RealmConfig } from '@cardstack/core/src/interfaces';
import Realm from './realms/fs-realm';
import { RealmInterface } from './interfaces';
export default class RealmManager implements RealmInterface {
    realms: Realm[];
    constructor(realmConfigs: RealmConfig[]);
    createRealm(config: RealmConfig, klass?: any): any;
    getRealm(url: string): RealmInterface;
    doesCardExist(url: string): boolean;
    getRawCard(url: string): Promise<RawCard>;
    updateCardData(cardURL: string, attributes: any): Promise<RawCard>;
    createDataCard(realmURL: string, data: any, adoptsFrom: string, cardURL?: string): Promise<RawCard>;
    deleteCard(cardURL: string): Promise<void>;
}
