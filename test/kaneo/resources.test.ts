import { describe, expect, it } from 'vitest';
import { operations } from '../../nodes/Kaneo/operations';
import { createContext } from './helpers';

const run = (
	operation: string,
	params: Record<string, unknown>,
	responses: Record<string, unknown>,
) => {
	const { ctx, requests } = createContext(params, responses);
	return operations[operation].call(ctx, 0).then((items) => ({ items, requests }));
};

const task = {
	id: 't1',
	projectId: 'p1',
	title: 'Old title',
	description: null,
	status: 'to-do',
	priority: null,
	position: 3,
	startDate: null,
	dueDate: '2026-01-01T00:00:00.000Z',
	userId: null,
};

describe('comments', () => {
	it('getAll returns one item per comment', async () => {
		const { items, requests } = await run(
			'comment.getAll',
			{ taskId: 't1' },
			{
				'GET comment/t1': [{ id: 'c1' }, { id: 'c2' }],
			},
		);
		expect(items.map((i) => i.json.id)).toEqual(['c1', 'c2']);
		expect(requests[0].method).toBe('GET');
	});

	it('create posts the content', async () => {
		const { items, requests } = await run(
			'comment.create',
			{ taskId: 't1', content: 'hi' },
			{
				'POST comment/t1': { id: 'a1' },
			},
		);
		expect(requests[0].body).toEqual({ content: 'hi' });
		expect(items[0].json.id).toBe('a1');
	});

	it('create rejects empty content like the API does', async () => {
		await expect(
			run('comment.create', { taskId: 't1', content: '' }, { 'POST comment/t1': {} }),
		).rejects.toThrow(/content.*at least 1/);
	});

	it('update puts the content', async () => {
		const { requests } = await run(
			'comment.update',
			{ commentId: 'c1', content: 'edited' },
			{
				'PUT comment/c1': { id: 'c1' },
			},
		);
		expect(requests[0].body).toEqual({ content: 'edited' });
	});

	it('delete calls DELETE', async () => {
		const { requests } = await run(
			'comment.delete',
			{ commentId: 'c1' },
			{
				'DELETE comment/c1': { id: 'c1' },
			},
		);
		expect(requests[0].method).toBe('DELETE');
	});
});

describe('labels', () => {
	it('create sends the workspace from the credentials', async () => {
		const { requests } = await run(
			'label.create',
			{ name: 'Bug', color: '#f00' },
			{
				'POST label': { id: 'l1' },
			},
		);
		expect(requests[0].body).toEqual({ name: 'Bug', color: '#f00', workspaceId: 'ws1' });
	});

	it('create on a task includes taskId', async () => {
		const { requests } = await run(
			'label.create',
			{ name: 'Bug', color: '#f00', taskId: 't1' },
			{
				'POST label': { id: 'l1' },
			},
		);
		expect(requests[0].body).toMatchObject({ taskId: 't1' });
	});

	it('get / delete use the label id', async () => {
		const get = await run('label.get', { labelId: 'l1' }, { 'GET label/l1': { id: 'l1' } });
		expect(get.items[0].json.id).toBe('l1');
		const del = await run('label.delete', { labelId: 'l1' }, { 'DELETE label/l1': { id: 'l1' } });
		expect(del.requests[0].method).toBe('DELETE');
	});

	it('getAll in workspace scope can keep only workspace-level definitions', async () => {
		const labels = [
			{ id: 'l1', taskId: null },
			{ id: 'l2', taskId: 't1' },
		];
		const all = await run(
			'label.getAll',
			{ scope: 'workspace' },
			{ 'GET label/workspace/ws1': labels },
		);
		expect(all.items).toHaveLength(2);
		const only = await run(
			'label.getAll',
			{ scope: 'workspace', filters: { unassignedOnly: true } },
			{ 'GET label/workspace/ws1': labels },
		);
		expect(only.items.map((i) => i.json.id)).toEqual(['l1']);
	});

	it('getAll in task scope reads the task labels', async () => {
		const { items } = await run(
			'label.getAll',
			{ scope: 'task', taskId: 't1' },
			{
				'GET label/task/t1': [{ id: 'l2' }],
			},
		);
		expect(items).toHaveLength(1);
	});

	it('update fills the missing field from the existing label', async () => {
		const { requests } = await run(
			'label.update',
			{ labelId: 'l1', updateFields: { name: 'New' } },
			{
				'GET label/l1': { id: 'l1', name: 'Old', color: '#00f' },
				'PUT label/l1': { id: 'l1' },
			},
		);
		expect(requests[1].body).toEqual({ name: 'New', color: '#00f' });
	});

	it('attach / detach hit the /task sub-resource', async () => {
		const attach = await run(
			'label.attach',
			{ labelId: 'l1', taskId: 't1' },
			{
				'PUT label/l1/task': { id: 'copy' },
			},
		);
		expect(attach.requests[0].body).toEqual({ taskId: 't1' });
		const detach = await run(
			'label.detach',
			{ labelId: 'copy' },
			{
				'DELETE label/copy/task': { id: 'copy' },
			},
		);
		expect(detach.requests[0].method).toBe('DELETE');
	});
});

describe('projects and statuses', () => {
	it('project.getAll filters by the credentials workspace', async () => {
		const { items, requests } = await run(
			'project.getAll',
			{},
			{
				'GET project': [{ id: 'p1' }, { id: 'p2' }],
			},
		);
		expect(requests[0].qs).toEqual({ workspaceId: 'ws1' });
		expect(items).toHaveLength(2);
	});

	it('project.get reads one project', async () => {
		const { items } = await run(
			'project.get',
			{ projectId: 'p1' },
			{ 'GET project/p1': { id: 'p1' } },
		);
		expect(items[0].json.id).toBe('p1');
	});

	it('status.getAll lists the project columns', async () => {
		const { items } = await run(
			'status.getAll',
			{ projectId: 'p1' },
			{
				'GET column/p1': [{ id: 'c1' }, { id: 'c2' }],
			},
		);
		expect(items).toHaveLength(2);
	});
});

describe('search', () => {
	const response = { 'GET search': { results: [{ id: 'r1' }, { id: 'r2' }], totalCount: 7 } };

	it('sends query, type, workspace and limit', async () => {
		const { items, requests } = await run(
			'search.search',
			{ query: 'foo', type: 'tasks', limit: 20 },
			response,
		);
		expect(requests[0].qs).toEqual({ q: 'foo', type: 'tasks', workspaceId: 'ws1', limit: 20 });
		expect(items.every((i) => i.json.totalCount === 7)).toBe(true);
	});

	it('adds projectId only when set', async () => {
		const { requests } = await run('search.search', { query: 'foo', projectId: 'p1' }, response);
		expect(requests[0].qs).toMatchObject({ projectId: 'p1' });
	});

	it('rejects an unsupported type like the API does', async () => {
		await expect(run('search.search', { query: 'foo', type: 'bogus' }, response)).rejects.toThrow(
			/400/,
		);
	});
});

describe('task relations', () => {
	it('create maps task ids and relation type', async () => {
		const { requests } = await run(
			'taskRelation.create',
			{ taskId: 't1', targetTaskId: 't2', relationType: 'blocks' },
			{ 'POST task-relation': { id: 'r1' } },
		);
		expect(requests[0].body).toEqual({
			sourceTaskId: 't1',
			targetTaskId: 't2',
			relationType: 'blocks',
		});
	});

	it('create rejects a relation type outside the spec', async () => {
		await expect(
			run(
				'taskRelation.create',
				{ taskId: 't1', targetTaskId: 't2', relationType: 'parent' },
				{
					'POST task-relation': {},
				},
			),
		).rejects.toThrow(/relationType/);
	});

	it('getAll / delete', async () => {
		const all = await run(
			'taskRelation.getAll',
			{ taskId: 't1' },
			{ 'GET task-relation/t1': [{ id: 'r1' }] },
		);
		expect(all.items).toHaveLength(1);
		const del = await run(
			'taskRelation.delete',
			{ relationId: 'r1' },
			{ 'DELETE task-relation/r1': { id: 'r1' } },
		);
		expect(del.requests[0].method).toBe('DELETE');
	});
});

describe('tasks', () => {
	it('create fills the fields the API requires', async () => {
		const { requests } = await run(
			'task.create',
			{ projectId: 'p1', title: 'T' },
			{ 'POST task/p1': task },
		);
		expect(requests[0].body).toEqual({
			title: 'T',
			description: '',
			status: 'to-do',
			priority: 'no-priority',
		});
	});

	it('create passes optional fields and drops empty ones', async () => {
		const { requests } = await run(
			'task.create',
			{
				projectId: 'p1',
				title: 'T',
				additionalFields: { priority: 'high', status: 'doing', dueDate: '', userId: 'u1' },
			},
			{ 'POST task/p1': task },
		);
		expect(requests[0].body).toMatchObject({ priority: 'high', status: 'doing', userId: 'u1' });
		expect(requests[0].body).not.toHaveProperty('dueDate');
	});

	it('create rejects an unknown priority', async () => {
		await expect(
			run(
				'task.create',
				{ projectId: 'p1', title: 'T', additionalFields: { priority: 'asap' } },
				{
					'POST task/p1': task,
				},
			),
		).rejects.toThrow('Invalid priority: asap. Allowed values: no-priority, low, medium, high, urgent');
	});

	it('create normalizes the priority string', async () => {
		const { requests } = await run(
			'task.create',
			{ projectId: 'p1', title: 'T', additionalFields: { priority: ' High ' } },
			{ 'POST task/p1': task },
		);
		expect(requests[0].body).toMatchObject({ priority: 'high' });
	});

	it('update validates the priority before calling the API', async () => {
		const { ctx, requests } = createContext(
			{ taskId: 't1', updateFields: { priority: 'asap' } },
			{ 'GET task/t1': task, 'PUT task/t1': task },
		);
		await expect(operations['task.update'].call(ctx, 0)).rejects.toThrow(/Invalid priority/);
		expect(requests).toHaveLength(0);
	});

	it('update sets a new priority', async () => {
		const { requests } = await run(
			'task.update',
			{ taskId: 't1', updateFields: { priority: 'urgent' } },
			{ 'GET task/t1': task, 'PUT task/t1': task },
		);
		expect(requests[1].body).toMatchObject({ priority: 'urgent' });
	});

	it('get / delete', async () => {
		const get = await run('task.get', { taskId: 't1' }, { 'GET task/t1': task });
		expect(get.items[0].json.id).toBe('t1');
		const del = await run('task.delete', { taskId: 't1' }, { 'DELETE task/t1': task });
		expect(del.requests[0].method).toBe('DELETE');
	});

	it('update merges the changes over the current task and drops null optionals', async () => {
		const { requests } = await run(
			'task.update',
			{ taskId: 't1', updateFields: { title: 'New title', userId: '' } },
			{ 'GET task/t1': task, 'PUT task/t1': task },
		);
		expect(requests[1].body).toEqual({
			title: 'New title',
			description: '',
			status: 'to-do',
			priority: 'no-priority',
			projectId: 'p1',
			position: 3,
			dueDate: '2026-01-01T00:00:00.000Z',
		});
	});

	it('move sends the destination and returns the source project', async () => {
		const { items, requests } = await run(
			'task.move',
			{ taskId: 't1', projectId: 'p2', destinationStatus: 'doing' },
			{ 'PUT task/move/t1': { task, sourceProjectId: 'p1', destinationProjectId: 'p2' } },
		);
		expect(requests[0].body).toEqual({ destinationProjectId: 'p2', destinationStatus: 'doing' });
		expect(items[0].json.sourceProjectId).toBe('p1');
	});

	it('move omits destinationStatus when empty', async () => {
		const { requests } = await run(
			'task.move',
			{ taskId: 't1', projectId: 'p2' },
			{
				'PUT task/move/t1': { task, sourceProjectId: 'p1', destinationProjectId: 'p2' },
			},
		);
		expect(requests[0].body).toEqual({ destinationProjectId: 'p2' });
	});
});
