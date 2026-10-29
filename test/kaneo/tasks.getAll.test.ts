import { describe, expect, it, vi } from 'vitest';
import type { IExecuteFunctions, IHttpRequestOptions } from 'n8n-workflow';
import { getTasks } from '../../nodes/Kaneo/resources/tasks/getAll';
import { validateRequest } from './openapiValidator';

const task = (id: string) => ({ id, title: id });

function board(ids: string[], extra: { archived?: string[]; planned?: string[] } = {}) {
	return {
		columns: [{ id: 'c1', name: 'To Do', tasks: ids.map(task) }],
		archivedTasks: (extra.archived ?? []).map(task),
		plannedTasks: (extra.planned ?? []).map(task),
	};
}

function setup(
	params: Record<string, unknown>,
	pages: Array<{ ids: string[] } & Record<string, unknown>>,
) {
	const calls: Array<Record<string, unknown>> = [];
	const httpRequestWithAuthentication = vi.fn(
		async (_cred: string, options: IHttpRequestOptions) => {
			// Behave like the real API: reject requests that violate the OpenAPI spec with 400
			const errors = validateRequest(options.method, options.url, options.qs);
			if (errors.length) throw new Error(`400 Bad Request: ${errors.join('; ')}`);
			if (options.url.endsWith('/column/p1')) {
				return ['to-do', 'in-progress', 'done'].map((slug) => ({ slug }));
			}
			calls.push(options.qs);
			const page = pages[options.qs.page - 1];
			return {
				data: board(page.ids, page),
				pagination: {
					total: 0,
					page: options.qs.page,
					pageSize: options.qs.limit,
					totalPages: pages.length,
				},
			};
		},
	);
	const ctx = {
		getNodeParameter: (name: string, _i: number, fallback: unknown) =>
			name in params ? params[name] : fallback,
		getNode: () => ({ name: 'Kaneo' }),
		getCredentials: async () => ({ url: 'https://kaneo.test/' }),
		helpers: { httpRequestWithAuthentication },
	} as unknown as IExecuteFunctions;
	return { ctx, calls, httpRequestWithAuthentication };
}

const ids = (from: number, to: number) =>
	Array.from({ length: to - from + 1 }, (_, i) => `t${from + i}`);

describe('Kaneo tasks getAll', () => {
	it('returns all tasks across pages without violating the API spec', async () => {
		const { ctx } = setup({ projectId: 'p1', returnAll: true }, [
			{ ids: ids(1, 100) },
			{ ids: ids(101, 150) },
		]);
		const result = await getTasks.call(ctx, 0);
		expect(result).toHaveLength(150);
	});

	it('caps the page size at the API maximum for a large requested limit', async () => {
		const { ctx, calls } = setup({ projectId: 'p1', returnAll: false, limit: 250 }, [
			{ ids: ids(1, 100) },
		]);
		await getTasks.call(ctx, 0);
		expect(calls[0].limit).toBe(100);
	});

	it('requests only what is needed for a small limit', async () => {
		const { ctx, calls } = setup({ projectId: 'p1', returnAll: false, limit: 5 }, [
			{ ids: ids(1, 5) },
		]);
		const result = await getTasks.call(ctx, 0);
		expect(calls).toHaveLength(1);
		expect(calls[0]).toMatchObject({ page: 1, limit: 5 });
		expect(result).toHaveLength(5);
	});

	it('follows pagination until the limit is reached and truncates', async () => {
		const { ctx, calls } = setup({ projectId: 'p1', returnAll: false, limit: 120 }, [
			{ ids: ids(1, 100) },
			{ ids: ids(101, 200) },
		]);
		const result = await getTasks.call(ctx, 0);
		expect(calls.map((c) => c.page)).toEqual([1, 2]);
		expect(calls[1].limit).toBe(20);
		expect(result).toHaveLength(120);
	});

	it('deduplicates archived/planned tasks repeated on every page', async () => {
		const { ctx } = setup({ projectId: 'p1', returnAll: true }, [
			{ ids: ['a'], archived: ['x'], planned: ['y'] },
			{ ids: ['b'], archived: ['x'], planned: ['y'] },
		]);
		const result = await getTasks.call(ctx, 0);
		expect(result.map((r) => r.json.id)).toEqual(['a', 'x', 'y', 'b']);
	});

	it('tags tasks with column and bucket', async () => {
		const { ctx } = setup({ projectId: 'p1', returnAll: true }, [
			{ ids: ['a'], archived: ['x'], planned: ['y'] },
		]);
		const result = await getTasks.call(ctx, 0);
		expect(result.map((r) => [r.json.column, r.json.bucket])).toEqual([
			['To Do', 'board'],
			[null, 'archived'],
			[null, 'planned'],
		]);
	});

	it('simplifies tasks to the essential fields when requested', async () => {
		const { ctx } = setup({ projectId: 'p1', returnAll: true, simplify: true }, [
			{ ids: ['a'], archived: ['x'] },
		]);
		const result = await getTasks.call(ctx, 0);
		expect(result.map((r) => r.json)).toEqual([
			{ id: 'a', title: 'a', bucket: 'board' },
			{ id: 'x', title: 'x', bucket: 'archived' },
		]);
	});

	it('returns the description as plain text when simplified', async () => {
		const { ctx } = setup({ projectId: 'p1', returnAll: true, simplify: true }, [{ ids: ['a'] }]);
		const raw = {
			id: 'a',
			number: 57,
			title: 'Fix',
			status: 'to-do',
			priority: 'high',
			description: '<p>See <a href="u">https://x.test/?a=1&amp;b=2</a></p>',
			userId: null,
			assigneeId: null,
			assigneeName: null,
			startDate: null,
			dueDate: null,
			labels: [],
			externalLinks: [],
		};
		vi.mocked(ctx.helpers.httpRequestWithAuthentication).mockResolvedValueOnce({
			data: { columns: [{ name: 'To Do', tasks: [raw] }], archivedTasks: [], plannedTasks: [] },
			pagination: { totalPages: 1 },
		});
		const result = await getTasks.call(ctx, 0);
		expect(result[0].json).toEqual({
			id: 'a',
			number: 57,
			title: 'Fix',
			status: 'to-do',
			priority: 'high',
			description: 'See https://x.test/?a=1&b=2',
			bucket: 'board',
		});
	});

	it('searches titles case-insensitively across pages and keeps search out of the query', async () => {
		const { ctx, calls } = setup(
			{ projectId: 'p1', returnAll: false, limit: 2, filters: { search: 'T1' } },
			[{ ids: ids(1, 100) }, { ids: ids(101, 200) }],
		);
		const result = await getTasks.call(ctx, 0);
		expect(result.map((r) => r.json.id)).toEqual(['t1', 't10']);
		expect(calls[0]).toMatchObject({ limit: 100 });
		expect(calls[0]).not.toHaveProperty('search');
	});

	it.each(['47', '#47', 47])('finds a task by number %s', async (number) => {
		const { ctx, httpRequestWithAuthentication } = setup(
			{ projectId: 'p1', returnAll: true, filters: { number } },
			[],
		);
		vi.mocked(httpRequestWithAuthentication).mockResolvedValueOnce({
			data: {
				columns: [
					{
						name: 'To Do',
						tasks: [
							{ id: 'a', number: 46, title: 'A' },
							{ id: 'b', number: 47, title: 'B' },
						],
					},
				],
				archivedTasks: [],
				plannedTasks: [],
			},
			pagination: { totalPages: 1 },
		});
		const result = await getTasks.call(ctx, 0);
		expect(result.map((r) => r.json.id)).toEqual(['b']);
		expect(httpRequestWithAuthentication.mock.calls[0][1].qs).not.toHaveProperty('number');
	});

	it('rejects an invalid task number without calling the API', async () => {
		const { ctx, httpRequestWithAuthentication } = setup(
			{ projectId: 'p1', returnAll: true, filters: { number: 'abc' } },
			[{ ids: ['a'] }],
		);
		await expect(getTasks.call(ctx, 0)).rejects.toThrow('Invalid task number: abc');
		expect(httpRequestWithAuthentication).not.toHaveBeenCalled();
	});

	it('forwards filters but drops empty ones', async () => {
		const { ctx, calls } = setup(
			{
				projectId: 'p1',
				returnAll: false,
				limit: 10,
				filters: { status: '', priority: 'high', sortBy: 'title' },
			},
			[{ ids: ['a'] }],
		);
		await getTasks.call(ctx, 0);
		expect(calls[0]).toMatchObject({ priority: 'high', sortBy: 'title' });
		expect(calls[0]).not.toHaveProperty('status');
	});

	it.each([
		['sortBy', 'name'],
		['sortOrder', 'up'],
	])('rejects %s value outside the API enum without calling the API', async (name, value) => {
		const { ctx, httpRequestWithAuthentication } = setup(
			{ projectId: 'p1', returnAll: false, limit: 1, filters: { [name]: value } },
			[{ ids: ['a'] }],
		);
		await expect(getTasks.call(ctx, 0)).rejects.toThrow(`Invalid value for "${name}"`);
		expect(httpRequestWithAuthentication).not.toHaveBeenCalled();
	});

	it('normalizes the priority filter', async () => {
		const { ctx, calls } = setup(
			{ projectId: 'p1', returnAll: false, limit: 1, filters: { priority: ' High ' } },
			[{ ids: ['a'] }],
		);
		await getTasks.call(ctx, 0);
		expect(calls[0]).toMatchObject({ priority: 'high' });
	});

	it('rejects an unknown priority without calling the API', async () => {
		const { ctx, httpRequestWithAuthentication } = setup(
			{ projectId: 'p1', returnAll: false, limit: 1, filters: { priority: 'critical' } },
			[{ ids: ['a'] }],
		);
		await expect(getTasks.call(ctx, 0)).rejects.toThrow(
			'Invalid priority: critical. Allowed values: no-priority, low, medium, high, urgent',
		);
		expect(httpRequestWithAuthentication).not.toHaveBeenCalled();
	});

	it('accepts a status that matches a project column', async () => {
		const { ctx, calls } = setup(
			{ projectId: 'p1', returnAll: false, limit: 1, filters: { status: 'in-progress' } },
			[{ ids: ['a'] }],
		);
		await getTasks.call(ctx, 0);
		expect(calls[0]).toMatchObject({ status: 'in-progress' });
	});

	it('rejects an unknown status and lists the valid ones', async () => {
		const { ctx, calls } = setup(
			{ projectId: 'p1', returnAll: false, limit: 1, filters: { status: 'In Progress' } },
			[{ ids: ['a'] }],
		);
		await expect(getTasks.call(ctx, 0)).rejects.toThrow(
			'Invalid status: In Progress. Valid statuses for this project: to-do, in-progress, done',
		);
		expect(calls).toHaveLength(0);
	});

	it('calls the correct URL', async () => {
		const { ctx, httpRequestWithAuthentication } = setup(
			{ projectId: 'p1', returnAll: false, limit: 1 },
			[{ ids: ['a'] }],
		);
		await getTasks.call(ctx, 0);
		expect(httpRequestWithAuthentication.mock.calls[0][1]).toMatchObject({
			method: 'GET',
			url: 'https://kaneo.test/api/task/tasks/p1',
		});
	});
});

describe('openapi validator', () => {
	it('rejects limit above the spec maximum', () => {
		expect(validateRequest('GET', 'https://k.test/api/task/tasks/p1', { limit: 200 })).toEqual([
			'"limit" must be <= 100, got 200',
		]);
	});
	it('rejects unknown params and bad enums', () => {
		expect(
			validateRequest('GET', 'https://k.test/api/task/tasks/p1', { foo: 1, sortBy: 'x' }),
		).toHaveLength(2);
	});
});
