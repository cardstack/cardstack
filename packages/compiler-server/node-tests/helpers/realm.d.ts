/// <reference types="mocha" />
import { RealmConfig } from '@cardstack/core/src/interfaces';
import { Project } from 'scenario-tester';
import RealmManager from '../../src/realm-manager';
import FSRealm from '../../src/realms/fs-realm';
export declare class ProjectTestRealm extends FSRealm {
    project: Project;
    constructor(config: RealmConfig, manager: RealmManager);
    addCard(cardID: string, files: Project['files']): void;
}
export declare function setupRealms(mochaContext: Mocha.Suite): {
    createRealm: (name: string) => ProjectTestRealm;
    getRealmManager: () => RealmManager;
};
