import Controller from '@ember/controller';

const CURRENT_TIME = "2020-09-19T16:58";

export default class WorkflowOrgThreadController extends Controller {
  now = CURRENT_TIME || Date.now();

  get activeTasks() {
    if (!this.model.thread.tasks) { return null; }
    return this.model.thread.tasks.filter(el => !el.completed);
  }

  get completedTasks() {
    if (!this.model.thread.tasks) { return null; }
    return this.model.thread.tasks.filter(el => el.completed);
  }

  get userTasks() {
    if (!this.activeTasks || !this.model.user) { return null; }
    return this.activeTasks.filter(el => el.assigned_to === this.model.user.id);
  }

  get assignedTasks() {
    // tasks assigned from this user or by the system to others
    if (!this.activeTasks || !this.model.user) { return null; }
    // do not count self-assigned tasks
    return this.activeTasks.filter(el => (el.assigned_by === this.model.user.id || el.assigned_by === "system") && el.assigned_to !== this.model.user.id);
  }
}
