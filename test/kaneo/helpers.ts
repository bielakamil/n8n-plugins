import { vi } from 'vitest';
import type { IDataObject, IExecuteFunctions, IHttpRequestOptions } from 'n8n-workflow';
import { validateRequest } from './openapiValidator';

export interface RecordedRequest {
	method: string;
	url: string;
	qs: IDataObject;
	body: IDataObject | undefined;
}

export const CREDENTIALS = {
	url: 'https://kaneo.test/',
	accessToken: 'token',
	workspaceId: 'ws1',
};

type Responder = unknown | ((request: RecordedRequest) => unknown);

/**
 * Builds a fake n8n execution context. `responses` maps "METHOD path" (relative to /api)
 * to the response body. Every request is validated against the Kaneo OpenAPI spec first,
 * so the fake rejects with a 400 exactly where the real API would.
 */
export function createContext(
	params: Record<string, unknown>,
	responses: Record<string, Responder>,
) {
	const requests: RecordedRequest[] = [];

	const httpRequestWithAuthentication = vi.fn(async (_credential: string, options: IHttpRequestOptions) => {
		const request: RecordedRequest = {
			method: options.method,
			url: options.url,
			qs: (options.qs as IDataObject) ?? {},
			body: options.body as IDataObject | undefined,
		};
		const errors = validateRequest(request.method, request.url, request.qs, request.body);
		if (errors.length) throw new Error(`400 Bad Request: ${errors.join('; ')}`);
		requests.push(request);

		const key = `${request.method} ${new URL(request.url).pathname.replace(/^\/api\//, '')}`;
		if (!(key in responses)) throw new Error(`No fake response registered for "${key}"`);
		const responder = responses[key];
		return typeof responder === 'function' ? responder(request) : responder;
	});

	const ctx = {
		getNodeParameter: (name: string, _item: number, fallback?: unknown) =>
			name in params ? params[name] : fallback,
		getNode: () => ({ name: 'Kaneo' }),
		getCredentials: async () => CREDENTIALS,
		helpers: { httpRequestWithAuthentication },
	} as unknown as IExecuteFunctions;

	return { ctx, requests };
}
