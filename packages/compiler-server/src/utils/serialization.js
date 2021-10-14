"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.serializeRawCard = exports.deserialize = exports.serializeCard = void 0;
const jsonapi_serializer_1 = require("jsonapi-serializer");
const mapKeys_1 = __importDefault(require("lodash/mapKeys"));
const camelCase_1 = __importDefault(require("lodash/camelCase"));
const jsonapi_1 = require("@cardstack/core/src/jsonapi");
async function serializeCard(url, data, component) {
    let cardSerializer = new jsonapi_serializer_1.Serializer('card', {
        attributes: component.usedFields,
        keyForAttribute: 'camelCase',
        dataMeta: {
            componentModule: component.moduleName,
        },
    });
    return cardSerializer.serialize(Object.assign({ id: url }, data));
}
exports.serializeCard = serializeCard;
function deserialize(payload) {
    let data = payload;
    if (data.data) {
        data = data.data;
    }
    if (data) {
        data = mapKeys_1.default(data, (_val, key) => camelCase_1.default(key));
    }
    return data;
}
exports.deserialize = deserialize;
function serializeResource(type, id, attributes, payload) {
    var _a, _b;
    let resource = {
        id,
        type,
        attributes: {},
        relationships: {},
    };
    for (const attr of attributes) {
        if (typeof attr === 'object') {
            let [aliasName, name] = Object.entries(attr)[0];
            resource.attributes[aliasName] = (_a = payload[name]) !== null && _a !== void 0 ? _a : null;
        }
        else {
            resource.attributes[attr] = (_b = payload[attr]) !== null && _b !== void 0 ? _b : null;
        }
    }
    return resource;
}
function serializeRawCard(card, compiled) {
    let resource = serializeResource('raw-cards', card.url, ['schema', 'isolated', 'embedded', 'edit', 'deserializer', 'adoptsFrom', 'files', 'data'], card);
    let doc = { data: resource };
    if (compiled) {
        doc.included = [];
        resource.relationships = {
            compiledMeta: { data: includeCompiledMeta(compiled, doc) },
        };
    }
    return doc;
}
exports.serializeRawCard = serializeRawCard;
function includeCompiledMeta(compiled, doc) {
    if (!jsonapi_1.findIncluded(doc, { type: 'compiled-metas', id: compiled.url })) {
        let resource = serializeResource('compiled-metas', compiled.url, ['schemaModule', 'serializer', 'isolated', 'embedded', 'edit'], compiled);
        doc.included.push(resource);
        if (compiled.adoptsFrom) {
            resource.relationships.adoptsFrom = {
                data: includeCompiledMeta(compiled.adoptsFrom, doc),
            };
        }
        resource.relationships.fields = {
            data: Object.values(compiled.fields).map((field) => includeField(compiled, field, doc)),
        };
    }
    return { type: 'compiled-metas', id: compiled.url };
}
function includeField(parent, field, doc) {
    let id = `${parent.url}/${field.name}`;
    if (!jsonapi_1.findIncluded(doc, { type: 'fields', id })) {
        let resource = serializeResource('fields', id, ['name', { fieldType: 'type' }], field);
        doc.included.push(resource);
        resource.relationships.card = {
            data: includeCompiledMeta(field.card, doc),
        };
    }
    return { type: 'fields', id };
}
//# sourceMappingURL=serialization.js.map