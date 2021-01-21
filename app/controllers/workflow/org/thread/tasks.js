import WorkflowOrgThreadController from '../thread';

export default class WorkflowOrgThreadTasksController extends WorkflowOrgThreadController {
  tasklistCols = [
    {
      name: 'Assigned By',
      valuePath: 'assigned_by',
      width: 150,
      type: 'participant',
    },
    {
      name: 'Task',
      valuePath: 'title',
      width: 300,
      type: 'task',
    },
    {
      name: 'Due Date',
      valuePath: 'due_date',
      width: 150,
      type: 'date',
    },
    {
      name: 'Assignee',
      valuePath: 'assigned_to',
      width: 150,
      type: 'participant',
    },
    {
      name: 'Shortcut',
      valuePath: 'shortcut_link',
    },
  ];
}
