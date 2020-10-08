import Component from '@glimmer/component';
export default class IsolatedCollection extends Component {
    format: string;
    selectedCards: string[];
    constructor(owner: unknown, args: any);
    changeFormat(val: string): void;
    toggleSelect(id: string): string[] | undefined;
}
