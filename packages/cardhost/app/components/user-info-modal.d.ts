import Component from '@glimmer/component';
export default class UserInfoModalComponent extends Component<{
    title: string;
    mode: string;
    icon: string;
    closeDialog: () => void;
}> {
    willDestroy(): void;
}
