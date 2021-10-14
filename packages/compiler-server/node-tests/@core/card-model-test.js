"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const date_fns_1 = require("date-fns");
const chai_1 = require("chai");
const fixtures_1 = require("@cardstack/core/tests/helpers/fixtures");
const card_model_1 = __importDefault(require("@cardstack/core/src/card-model"));
function p(dateString) {
    return date_fns_1.parse(dateString, 'yyyy-MM-dd', new Date());
}
class PersonCardModel extends card_model_1.default {
}
PersonCardModel.serializerMap = {
    date: ['birthdate', 'address.settlementDate'],
};
let attributes = {
    name: 'Bob Barker',
    birthdate: '1923-12-12',
    address: {
        street: '101 Price is Right ln',
        city: 'Los Angeles',
        state: 'CA',
        settlementDate: '1990-01-01',
    },
};
let cardJSONResponse = {
    data: {
        id: fixtures_1.PERSON_RAW_CARD.url,
        type: 'card',
        attributes,
        meta: {
            componentModule: '',
        },
    },
};
class StubCards {
    async load(_url, _format) {
        throw new Error('unimplemented');
    }
    async send(op) {
        this.lastOp = op;
        return { data: { type: 'cards', id: 'x' } };
    }
    prepareComponent() { }
    tracked(_target, _prop, desc) {
        return desc;
    }
}
const fakeComponent = {};
describe('CardModel', function () {
    it('.data', async function () {
        let stub = new StubCards();
        let model = PersonCardModel.fromResponse(stub, cardJSONResponse, fakeComponent);
        chai_1.expect(model.data.name).to.equal(attributes.name);
        chai_1.expect(date_fns_1.isSameDay(model.data.birthdate, p('1923-12-12')), 'Dates are serialized to Dates').to.be.ok;
        chai_1.expect(model.data.address.street).to.equal(attributes.address.street);
        chai_1.expect(date_fns_1.isSameDay(model.data.address.settlementDate, p('1990-01-01')), 'Dates are serialized to Dates').to.be.ok;
    });
    it('.serialize', async function () {
        let stub = new StubCards();
        let model = PersonCardModel.fromResponse(stub, cardJSONResponse, fakeComponent);
        await model.save();
        let op = stub.lastOp;
        if (!op || !('update' in op)) {
            throw new Error(`did not find create operation`);
        }
        chai_1.expect(op.update.payload, 'A model can be serialized once instantiated').to.deep.equal({
            data: {
                id: fixtures_1.PERSON_RAW_CARD.url,
                type: 'card',
                attributes,
            },
        });
    });
});
//# sourceMappingURL=card-model-test.js.map