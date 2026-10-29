import type { IDataObject, IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';
import { htmlToText } from '../../utils/html';
import { kaneoRequest } from '../../utils/request';
import { parsePriority } from './priority';
import { KaneoColumn, KaneoTask, KaneoTaskBoard, KaneoTaskBoardResponse } from '../../utils/types';

/** Maximum page size accepted by the Kaneo API */
const MAX_PAGE_SIZE = 100;

/** Allowed values of enum query params, as defined by the Kaneo API */
const ENUM_FILTERS: Record<string, readonly string[]> = {
	sortBy: ['createdAt', 'priority', 'dueDate', 'position', 'title', 'number'],
	sortOrder: ['asc', 'desc'],
};

/** Filters the Kaneo API doesn't support, applied to the fetched tasks instead of sent as query params */
const CLIENT_FILTERS = ['number', 'search'];

type TaskBucket = 'board' | 'archived' | 'planned';

/** Builds a matcher for the client-side filters, or undefined when none is set */
function buildMatcher(
	this: IExecuteFunctions,
	filters: IDataObject,
	itemIndex: number,
): ((task: IDataObject) => boolean) | undefined {
	let number: number | undefined;
	if (filters.number !== undefined) {
		// Accept "#47" too, as that's how task numbers are shown in Kaneo
		number = Number(String(filters.number).trim().replace(/^#/, ''));
		if (!Number.isInteger(number) || number < 1) {
			throw new NodeOperationError(
				this.getNode(),
				`Invalid task number: ${String(filters.number)}. Use a positive integer, e.g. 47`,
				{ itemIndex },
			);
		}
	}
	const search =
		filters.search !== undefined ? String(filters.search).trim().toLowerCase() : undefined;

	if (number === undefined && !search) return undefined;
	return (task) =>
		(number === undefined || task.number === number) &&
		(!search ||
			String(task.title ?? '')
				.toLowerCase()
				.includes(search));
}

/**
 * Keeps only the fields an AI agent needs to pick a task, without nulls, and turns the
 * description into plain text, which shrinks the response to a fraction of its raw size
 */
function simplifyTask(task: KaneoTask, bucket: TaskBucket): IDataObject {
	const simplified: IDataObject = {
		id: task.id,
		number: task.number,
		title: task.title,
		status: task.status,
		priority: task.priority,
		description: task.description ? htmlToText(task.description) : null,
		assigneeName: task.assigneeName,
		dueDate: task.dueDate,
		createdAt: task.createdAt,
		bucket,
	};
	return Object.fromEntries(
		Object.entries(simplified).filter(
			([, value]) => value !== null && value !== undefined && value !== '',
		),
	);
}

function toItem(
	task: KaneoTask,
	bucket: TaskBucket,
	column: string | null,
	itemIndex: number,
	simplify: boolean,
): INodeExecutionData {
	return {
		json: simplify
			? simplifyTask(task, bucket)
			: { ...(task as unknown as IDataObject), column, bucket },
		pairedItem: { item: itemIndex },
	};
}

function flattenBoard(
	board: KaneoTaskBoard,
	itemIndex: number,
	simplify: boolean,
): INodeExecutionData[] {
	return [
		...board.columns.flatMap((col) =>
			col.tasks.map((task) => toItem(task, 'board', col.name, itemIndex, simplify)),
		),
		...board.archivedTasks.map((task) => toItem(task, 'archived', null, itemIndex, simplify)),
		...board.plannedTasks.map((task) => toItem(task, 'planned', null, itemIndex, simplify)),
	];
}

export async function getTasks(
	this: IExecuteFunctions,
	itemIndex: number,
): Promise<INodeExecutionData[]> {
	const projectId = this.getNodeParameter('projectId', itemIndex, '', {
		extractValue: true,
	}) as string;
	const returnAll = this.getNodeParameter('returnAll', itemIndex, false) as boolean;
	const limit = returnAll ? Infinity : (this.getNodeParameter('limit', itemIndex, 50) as number);
	const simplify = this.getNodeParameter('simplify', itemIndex, false) as boolean;
	const filters = this.getNodeParameter('filters', itemIndex, {}) as IDataObject;

	// Drop empty strings so we don't send `status=` etc. to the API
	const setFilters = Object.fromEntries(
		Object.entries(filters).filter(([, value]) => value !== '' && value !== undefined),
	);
	const qs = Object.fromEntries(
		Object.entries(setFilters).filter(([name]) => !CLIENT_FILTERS.includes(name)),
	);
	const matches = buildMatcher.call(this, setFilters, itemIndex);

	// Values set via expressions bypass the options list, so check them before calling the API
	for (const [name, allowed] of Object.entries(ENUM_FILTERS)) {
		if (name in qs && !allowed.includes(qs[name] as string)) {
			throw new NodeOperationError(
				this.getNode(),
				`Invalid value for "${name}": ${String(qs[name])}. Allowed values: ${allowed.join(', ')}`,
				{ itemIndex },
			);
		}
	}

	// Like an unknown status, an unknown priority would silently return no tasks
	if (qs.priority !== undefined) {
		qs.priority = parsePriority.call(this, qs.priority, itemIndex);
	}

	// An unknown status slug makes the API return an empty board instead of an error, which
	// misleads AI tools (they only see a free-form string), so check it against the project's columns
	if (qs.status !== undefined) {
		const columns = (await kaneoRequest.call(this, 'GET', `column/${projectId}`)) as KaneoColumn[];
		const slugs = columns.map((column) => column.slug);
		if (!slugs.includes(qs.status as string)) {
			throw new NodeOperationError(
				this.getNode(),
				`Invalid status: ${String(qs.status)}. Valid statuses for this project: ${slugs.join(', ')}`,
				{ itemIndex },
			);
		}
	}

	const results: INodeExecutionData[] = [];
	// Guards against duplicates if the API repeats archived/planned tasks on every page
	const seen = new Set<string>();
	let page = 1;
	let totalPages = 1;

	while (page <= totalPages && results.length < limit) {
		const response = (await kaneoRequest.call(this, 'GET', `task/tasks/${projectId}`, {
			...qs,
			page,
			// With client-side filters we can't tell how many tasks we need, so fetch full pages
			limit: matches ? MAX_PAGE_SIZE : Math.min(limit - results.length, MAX_PAGE_SIZE),
		})) as KaneoTaskBoardResponse;

		for (const item of flattenBoard(response.data, itemIndex, simplify)) {
			const id = item.json.id as string;
			if (seen.has(id)) continue;
			seen.add(id);
			if (matches && !matches(item.json)) continue;
			results.push(item);
		}
		totalPages = response.pagination.totalPages;
		page++;
	}

	return results.slice(0, limit);
}
