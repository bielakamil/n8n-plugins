import { INodeProperties } from 'n8n-workflow';

const showOnlyForTasks = {
	resource: ['task'],
};

export const tasksDescription: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: showOnlyForTasks },
		default: 'getAll',
		options: [
			{
				name: 'Create',
				value: 'create',
				action: 'Create a task',
				description: 'Create a task in a Kaneo project',
			},
			{
				name: 'Delete',
				value: 'delete',
				action: 'Delete a task',
				description: 'Permanently delete a task with its comments, labels and time entries',
			},
			{
				name: 'Get',
				value: 'get',
				action: 'Get a task',
				description: 'Get a single task by ID',
			},
			{
				name: 'Get Many',
				value: 'getAll',
				action: 'Get many tasks',
				description: 'Get many tasks from a Kaneo project',
			},
			{
				name: 'Move',
				value: 'move',
				action: 'Move a task',
				description: 'Move a task to another project in the same workspace',
			},
			{
				name: 'Update',
				value: 'update',
				action: 'Update a task',
				description: 'Update fields of an existing task',
			},
		],
	},
	{
		displayName: 'Task ID',
		name: 'taskId',
		type: 'string',
		default: '',
		required: true,
		placeholder: 'e.g. 4e3b1c2a-...',
		description: 'ID of the task',
		displayOptions: {
			show: { ...showOnlyForTasks, operation: ['get', 'update', 'delete', 'move'] },
		},
	},
	{
		displayName: 'Project',
		name: 'projectId',
		type: 'resourceLocator',
		default: { mode: 'list', value: '' },
		required: true,
		description: 'The project the task belongs to (for Move: the destination project)',
		displayOptions: {
			show: { ...showOnlyForTasks, operation: ['getAll', 'create', 'move'] },
		},
		modes: [
			{
				displayName: 'From List',
				name: 'list',
				type: 'list',
				placeholder: 'Select a project...',
				typeOptions: {
					searchListMethod: 'getProjects',
					searchable: true,
					searchFilterRequired: false,
				},
			},
			{
				displayName: 'ID',
				name: 'id',
				type: 'string',
				placeholder: 'e.g. 4e3b1c2a-...',
			},
		],
	},
	{
		displayName: 'Destination Status',
		name: 'destinationStatus',
		type: 'string',
		default: '',
		placeholder: 'e.g. to-do',
		description:
			'Slug of the column in the destination project. Defaults to the first column of the destination project.',
		displayOptions: {
			show: { ...showOnlyForTasks, operation: ['move'] },
		},
	},
	{
		displayName: 'Title',
		name: 'title',
		type: 'string',
		default: '',
		required: true,
		description: 'Title of the task',
		displayOptions: {
			show: { ...showOnlyForTasks, operation: ['create'] },
		},
	},
	{
		displayName: 'Additional Fields',
		name: 'additionalFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: {
			show: { ...showOnlyForTasks, operation: ['create'] },
		},
		options: [
			{
				displayName: 'Assignee ID',
				name: 'userId',
				type: 'string',
				default: '',
				description: 'ID of the user to assign the task to',
			},
			{
				displayName: 'Description',
				name: 'description',
				type: 'string',
				typeOptions: { rows: 4 },
				default: '',
			},
			{
				displayName: 'Due Date',
				name: 'dueDate',
				type: 'dateTime',
				default: '',
			},
			{
				displayName: 'Priority',
				name: 'priority',
				type: 'string',
				default: 'no-priority',
				placeholder: 'e.g. high',
				description: 'One of: no-priority, low, medium, high, urgent',
			},
			{
				displayName: 'Start Date',
				name: 'startDate',
				type: 'dateTime',
				default: '',
			},
			{
				displayName: 'Status',
				name: 'status',
				type: 'string',
				default: 'to-do',
				placeholder: 'e.g. to-do',
				description:
					'Slug of the column to place the task in, e.g. to-do, in-progress, in-review or done (default columns). Custom columns have their own slugs.',
			},
		],
	},
	{
		displayName: 'Update Fields',
		name: 'updateFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: {
			show: { ...showOnlyForTasks, operation: ['update'] },
		},
		options: [
			{
				displayName: 'Assignee ID',
				name: 'userId',
				type: 'string',
				default: '',
				description: 'ID of the user to assign the task to',
			},
			{
				displayName: 'Description',
				name: 'description',
				type: 'string',
				typeOptions: { rows: 4 },
				default: '',
			},
			{
				displayName: 'Due Date',
				name: 'dueDate',
				type: 'dateTime',
				default: '',
			},
			{
				displayName: 'Priority',
				name: 'priority',
				type: 'string',
				default: '',
				placeholder: 'e.g. high',
				description: 'One of: no-priority, low, medium, high, urgent',
			},
			{
				displayName: 'Start Date',
				name: 'startDate',
				type: 'dateTime',
				default: '',
			},
			{
				displayName: 'Status',
				name: 'status',
				type: 'string',
				default: '',
				placeholder: 'e.g. to-do',
				description:
					'Slug of the column to move the task to, e.g. to-do, in-progress, in-review or done (default columns). Custom columns have their own slugs.',
			},
			{
				displayName: 'Title',
				name: 'title',
				type: 'string',
				default: '',
			},
		],
	},
	{
		displayName: 'Return All',
		name: 'returnAll',
		type: 'boolean',
		default: false,
		description: 'Whether to return all results or only up to a given limit',
		displayOptions: {
			show: { ...showOnlyForTasks, operation: ['getAll'] },
		},
	},
	{
		displayName: 'Limit',
		name: 'limit',
		type: 'number',
		typeOptions: { minValue: 1 },
		default: 50,
		description: 'Max number of results to return',
		displayOptions: {
			show: { ...showOnlyForTasks, operation: ['getAll'], returnAll: [false] },
		},
	},
	{
		displayName: 'Filters',
		name: 'filters',
		type: 'collection',
		placeholder: 'Add Filter',
		default: {},
		displayOptions: {
			show: { ...showOnlyForTasks, operation: ['getAll'] },
		},
		options: [
			{
				displayName: 'Assignee ID',
				name: 'assigneeId',
				type: 'string',
				default: '',
				description: 'Only return tasks assigned to this user',
			},
			{
				displayName: 'Priority',
				name: 'priority',
				type: 'string',
				default: '',
				placeholder: 'e.g. high',
				description: 'Only return tasks with this priority',
			},
			{
				displayName: 'Sort By',
				name: 'sortBy',
				type: 'options',
				default: 'position',
				options: [
					{ name: 'Created At', value: 'createdAt' },
					{ name: 'Due Date', value: 'dueDate' },
					{ name: 'Number', value: 'number' },
					{ name: 'Position', value: 'position' },
					{ name: 'Priority', value: 'priority' },
					{ name: 'Title', value: 'title' },
				],
			},
			{
				displayName: 'Sort Order',
				name: 'sortOrder',
				type: 'options',
				default: 'asc',
				options: [
					{ name: 'Ascending', value: 'asc' },
					{ name: 'Descending', value: 'desc' },
				],
			},
			{
				displayName: 'Status',
				name: 'status',
				type: 'string',
				default: '',
				placeholder: 'e.g. to-do',
				description:
					'Only return tasks in this column. Use its slug, e.g. to-do, in-progress, in-review or done (default columns), not its display name. Leave empty to return tasks from all columns. An unknown slug fails with the list of valid ones.',
			},
		],
	},
];
