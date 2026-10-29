import type { IDataObject, IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';
import { kaneoRequest } from '../../utils/request';
import { KaneoTask } from '../../utils/types';
import { parsePriority } from './priority';

export async function updateTask(
	this: IExecuteFunctions,
	itemIndex: number,
): Promise<INodeExecutionData[]> {
	const taskId = this.getNodeParameter('taskId', itemIndex) as string;
	const updateFields = this.getNodeParameter('updateFields', itemIndex, {}) as IDataObject;
	if (updateFields.priority) {
		updateFields.priority = parsePriority.call(this, updateFields.priority, itemIndex);
	}

	// PUT /task/{id} replaces every field (omitted ones become null), so merge over the current task
	const existing = (await kaneoRequest.call(this, 'GET', `task/${taskId}`)) as KaneoTask;

	// title, description, status, priority, projectId and position are required by the API;
	// startDate, dueDate and userId are optional strings (null is rejected), so drop them when unset
	const optional = Object.fromEntries(
		Object.entries({
			startDate: existing.startDate,
			dueDate: existing.dueDate,
			userId: existing.userId,
			...updateFields,
		}).filter(([, value]) => value !== '' && value !== null && value !== undefined),
	);

	const body: IDataObject = {
		title: existing.title,
		description: existing.description ?? '',
		status: existing.status,
		priority: existing.priority ?? 'no-priority',
		projectId: existing.projectId,
		position: existing.position,
		...optional,
	};

	const task = (await kaneoRequest.call(
		this,
		'PUT',
		`task/${taskId}`,
		{},
		body,
	)) as KaneoTask;

	return [
		{
			json: task as unknown as IDataObject,
			pairedItem: { item: itemIndex },
		},
	];
}
