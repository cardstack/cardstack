var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
import Service from '@ember/service';
import { inject as service } from '@ember/service';
import { UnsavedCard, AddressableCard, asCardId } from '@cardstack/core/card';
import { loadModule } from '../utils/scaffolding';
import { stringify } from 'qs';
import CardstackError from '@cardstack/core/error';
const memoizeCache = {};
export default class DataService extends Service {
    get hubURL() {
        return 'http://localhost:3000';
    }
    get reader() {
        return getMemoizedValue('reader', () => new Reader(this));
    }
    get moduleLoader() {
        return getMemoizedValue('moduleLoader', () => new Loader());
    }
    get container() {
        return getMemoizedValue('container', () => new Container());
    }
    async instantiate(jsonapi, imposeIdentity) {
        // TODO need to instantiate this from the container
        return new AddressableCard(jsonapi, this.reader, this.moduleLoader, this.container, imposeIdentity);
    }
    async create(realm, doc) {
        // TODO need to instantiate this from the container
        return new UnsavedCard(doc, realm, this.reader, this.moduleLoader, this.container, this);
    }
    async save(card) {
        let url = this.localURL(card);
        let response = await fetch(url, {
            method: card.csId != null ? 'PATCH' : 'POST',
            headers: {
                'Content-Type': 'application/vnd.api+json',
            },
            body: JSON.stringify((await card.asUpstreamDoc()).jsonapi),
        });
        if (!response.ok) {
            await handleJsonApiError(response);
        }
        let json = (await response.json());
        return await this.instantiate(json);
    }
    async delete(card) {
        var _a;
        let url = this.localURL(card);
        let version = ((_a = card.meta) === null || _a === void 0 ? void 0 : _a.version) || '';
        let response = await fetch(url, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/vnd.api+json',
                'If-Match': String(version),
            },
        });
        if (!response.ok) {
            await handleJsonApiError(response);
        }
    }
    async load(idOrURL, rules) {
        let id = asCardId(idOrURL);
        let url = this.localURL(id);
        if (rules !== 'everything') {
            url = `${url}?${stringify(rules)}`;
        }
        let response = await fetch(url, {
            headers: {
                'Content-Type': 'application/vnd.api+json',
            },
        });
        if (!response.ok) {
            await handleJsonApiError(response);
        }
        let json = (await response.json());
        return await this.instantiate(json);
    }
    async search(query, rules) {
        let url = `${this.hubURL}/api/cards?${stringify(query)}`;
        if (rules !== 'everything') {
            url = `${url}&${stringify(rules)}`;
        }
        let response = await fetch(url, {
            headers: {
                'Content-Type': 'application/vnd.api+json',
            },
        });
        if (!response.ok) {
            await handleJsonApiError(response);
        }
        let { data: cards } = (await response.json());
        return await Promise.all(cards.map(data => this.instantiate({ data })));
    }
    localURL(idOrCsRealm, csOriginalRealm) {
        let csRealm, csId;
        if (typeof idOrCsRealm === 'string') {
            csRealm = idOrCsRealm;
        }
        else {
            ({ csRealm, csId, csOriginalRealm } = idOrCsRealm);
        }
        if (csRealm == null) {
            throw new Error(`Must specify a csRealm either as a string or as part of a CardId`);
        }
        let isLocalRealm = csRealm.includes(this.hubURL);
        let requestRealm = isLocalRealm ? csRealm.split('/').pop() : csRealm;
        let url = isLocalRealm
            ? `${this.hubURL}/api/realms/${encodeURIComponent(requestRealm)}/cards`
            : csOriginalRealm
                ? `${this.hubURL}/api/remote-realms/${encodeURIComponent(requestRealm)}/cards/${encodeURIComponent(csOriginalRealm)}`
                : `${this.hubURL}/api/remote-realms/${encodeURIComponent(requestRealm)}/cards`;
        if (csId != null) {
            url = `${url}/${encodeURIComponent(csId)}`;
        }
        return url;
    }
}
__decorate([
    service
], DataService.prototype, "cardstackSession", void 0);
async function handleJsonApiError(response) {
    let jsonapiError = (await response.json());
    let detail = jsonapiError.errors.length ? jsonapiError.errors[0].detail : JSON.stringify(jsonapiError);
    throw new CardstackError(detail, { status: response.status });
}
class Reader {
    constructor(dataService) {
        this.dataService = dataService;
    }
    async get(idOrURL) {
        // TODO: this goes to the server, we'll eventually want to do something
        // smarter here, like return any supplied included resources that were
        // passed into the Card. And if the subsequent loads occur, they may
        // overfetch a resource that is needed in a different get for this
        // card--let's harness any over fetching efficiently.
        return await this.dataService.load(idOrURL, 'everything');
    }
}
class Loader {
    async load(card, localModulePath, exportedName) {
        return loadModule(card, localModulePath, exportedName);
    }
}
class Container {
    async instantiate(factory, ...args) {
        return new factory(...args); // TODO instantiate from the container
    }
}
function getMemoizedValue(fnName, fn) {
    if (memoizeCache[fnName] === undefined) {
        memoizeCache[fnName] = fn();
    }
    return memoizeCache[fnName];
}
//# sourceMappingURL=data.js.map