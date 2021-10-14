import { RawCard, RealmConfig } from '@cardstack/core/src/interfaces';
import { RealmInterface } from '../interfaces';
import RealmManager from '../realm-manager';
export default class FSRealm implements RealmInterface {
    url: string;
    directory: string;
    manager: RealmManager;
    constructor(config: RealmConfig, manager: RealmManager);
    doesCardExist(cardURL: string): boolean;
    private buildCardPath;
    private getRawCardLocation;
    private ensureIDIsUnique;
    getRawCard(cardURL: string): Promise<RawCard>;
    createDataCard(data: any, adoptsFrom: string, cardURL?: string): Promise<RawCard>;
    private generateIdFromParent;
    updateCardData(cardURL: string, attributes: any): Promise<RawCard>;
    deleteCard(cardURL: string): void;
}
