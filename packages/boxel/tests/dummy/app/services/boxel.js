import Service from '@ember/service';

export default class BoxelService extends Service {
  boxels = {};
  planes = {};
  currentPlane = 'space';

  getBoxelById(boxelId) {
    return this.boxels[boxelId];
  }

  moveBoxelToPlane(boxelId, planeId) {
    let boxel = this.getBoxelById(boxelId);

    this.currentPlane = planeId;
    boxel.moveToPlane(planeId);
  }

  registerPlane(plane) {
    this.planes[plane.name] = plane;
  }

  registerBoxel(boxel) {
    this.boxels[boxel.name] = boxel;
  }
}
