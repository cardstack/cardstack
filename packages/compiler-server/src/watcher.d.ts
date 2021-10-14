import Builder from './builder';
import sane from 'sane';
import RealmManager from './realm-manager';
export declare function cleanCache(dir: string): void;
export declare function primeCache(realManager: RealmManager, builder: Builder): Promise<void>;
export declare function setupWatchers(realmManager: RealmManager, builder: Builder): sane.Watcher[];
