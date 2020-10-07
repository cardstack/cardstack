import Component from '@glimmer/component';
import { AddressableCard } from '@cardstack/hub';
export default class IsolatedCollection extends Component {
    format: string;
    collection: AddressableCard[];
    constructor(owner: unknown, args: any);
    changeFormat(val: string): void;
}
