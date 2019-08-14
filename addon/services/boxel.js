import Service from '@ember/service';

export default class BoxelService extends Service {
  boxels = null;
  planes = null;
  currentPlane = 'space';

  init() {
    super.init(...arguments);
    this.set('boxels', {});
    this.set('planes', {});
  }

  getBoxelById(boxelId) {
    return this.boxels[boxelId];
  }

  moveBoxelToPlane(boxelId, planeId) {
    let boxel = this.getBoxelById(boxelId);

    this.set('currentPlane', planeId);
    boxel.sendAction('moveToPlane', planeId);
  }

  registerPlane(plane) {
    this.planes[plane.name] = plane;
  }

  registerBoxel(boxel) {
    this.boxels[boxel.name] = boxel;
  }
}