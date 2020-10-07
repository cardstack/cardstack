var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import { action } from '@ember/object';
export default class IsolatedCollection extends Component {
    constructor(owner, args) {
        super(owner, args);
        this.format = args.format || 'grid';
        this.collection = args.collection || [];
    }
    changeFormat(val) {
        this.format = val;
    }
}
__decorate([
    tracked
], IsolatedCollection.prototype, "format", void 0);
__decorate([
    tracked
], IsolatedCollection.prototype, "collection", void 0);
__decorate([
    action
], IsolatedCollection.prototype, "changeFormat", null);
//# sourceMappingURL=isolated-collection.js.map