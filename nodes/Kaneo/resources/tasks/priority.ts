import type { IExecuteFunctions } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

/** Allowed task priorities, as defined by the Kaneo API */
export const TASK_PRIORITIES = ['no-priority', 'low', 'medium', 'high', 'urgent'] as const;

/**
 * Priority is a free-form string (so AI tools can set it), so normalize it and reject
 * unknown values with the list of valid ones instead of a bare API validation error
 */
export function parsePriority(this: IExecuteFunctions, value: unknown, itemIndex: number): string {
	const priority = String(value).trim().toLowerCase();
	if (!(TASK_PRIORITIES as readonly string[]).includes(priority)) {
		throw new NodeOperationError(
			this.getNode(),
			`Invalid priority: ${String(value)}. Allowed values: ${TASK_PRIORITIES.join(', ')}`,
			{ itemIndex },
		);
	}
	return priority;
}
