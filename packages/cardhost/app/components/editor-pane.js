import Component from '@glimmer/component';
import { inject as service } from '@ember/service';

export default class EditorPane extends Component {
  @service cssModeToggle

  get resizeDirections() {
    if (this.cssModeToggle.dockLocation === "right") {
      return ["left"];
    } else {
      return ["top"];
    }
  }

  get width() {
    if (this.cssModeToggle.dockLocation === "right") {
      return "40%";
    } else {
      return "100%";
    }
  }

  get height() {
    if (this.cssModeToggle.dockLocation === "right") {
      return "100%";
    } else {
      return "40%";
    }
  }

  get classNames() {
    let classes = [];

    if (this.cssModeToggle.dockLocation === "bottom") {
      classes.push("bottom-docked");
    }

    if (this.cssModeToggle.visible === false) {
      classes.push("hidden");
    }

    return classes.join(" ");
  }
}