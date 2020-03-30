import Component from '@glimmer/component';
export default class UserInfoModalComponent extends Component {
    willDestroy() {
        if (this.args.closeDialog) {
            this.args.closeDialog();
        }
    }
}
//# sourceMappingURL=user-info-modal.js.map