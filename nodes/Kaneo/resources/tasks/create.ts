import type { IDataObject, IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';
import { kaneoRequest } from '../../utils/request';
import { KaneoTask } from '../../utils/types';
import { parsePriority } from './priority';

export async function createTask(
	this: IExecuteFunctions,
	itemIndex: number,
): Promise<INodeExecutionData[]> {
	const projectId = this.getNodeParameter('projectId', itemIndex, '', {
		extractValue: true,
	}) as string;
	const title = this.getNodeParameter('title', itemIndex) as string;
	const { description, status, priority, ...optional } = this.getNodeParameter(
		'additionalFields',
		itemIndex,
		{},
	) as IDataObject;

	// description, status and priority are required by the API, the rest is optional
	const body: IDataObject = {
		title,
		description: description ?? '',
		status: status || 'to-do',
		priority: priority ? parsePriority.call(this, priority, itemIndex) : 'no-priority',
		...Object.fromEntries(Object.entries(optional).filter(([, value]) => value !== '')),
	};

	const task = (await kaneoRequest.call(
		this,
		'POST',
		`task/${projectId}`,
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
