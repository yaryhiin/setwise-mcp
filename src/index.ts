import { McpServer, createMcpHandler } from '@modelcontextprotocol/server';
import { getSupabase } from './services/supabase';
import { success, z } from 'zod';

import type { Env } from './services/supabase';

function createServer(env: Env, accessToken: string) {
	const server = new McpServer({ name: 'setwise-mcp', version: '1.0.0' });

	server.registerTool(
		'hello',
		{ description: 'Greets user by their name', inputSchema: z.object({ name: z.string() }) },
		async ({ name }) => {
			return { content: [{ type: 'text', text: `Hello ${name}! Welcome to Setwise MCP!` }] };
		},
	);

	server.registerTool(
		'search_exercises',
		{
			description:
				'Find available exercises by name. Returns exercise IDs, names and categories. Use this tool to find valid exercises before creating a routine',
			inputSchema: z.object({ query: z.string().optional() }),
		},
		async ({ query }) => {
			const supabase = getSupabase(env, accessToken);

			let request = supabase.from('exercises').select('id, name, category').order('name').limit(50);

			if (query) {
				request = request.ilike('name', `%${query}%`);
			}

			const { data, error } = await request;

			if (error) {
				return {
					isError: true,
					content: [{ type: 'text', text: error.message }],
				};
			}

			return {
				content: [
					{
						type: 'text',
						text: JSON.stringify(data),
					},
				],
			};
		},
	);

	server.registerTool(
		'create_routine',
		{
			description:
				'Creates a workout routine for the authenticated user using existing exercise IDs. Use search_exercises first to find valid IDs. Exercise order is preserved.',
			inputSchema: z.object({
				name: z.string().trim().min(1).max(100),
				exercise_ids: z.array(z.uuid()).min(1).max(50),
			}),
		},
		async ({ name, exercise_ids }) => {
			const supabase = getSupabase(env, accessToken);

			const { data, error } = await supabase.rpc('create_routine_with_exercises', { p_name: name, p_exercise_ids: exercise_ids });

			if (error) {
				return { isError: true, content: [{ type: 'text', text: error.message }] };
			}

			return {
				content: [
					{
						type: 'text',
						text: JSON.stringify({ success: true, routine_id: data, name }),
					},
				],
			};
		},
	);

	return server;
}

export default {
	async fetch(request: Request, env: Env) {
		const url = new URL(request.url);

		const resource = env.MCP_RESOURCE_URL;
		const metadataUrl = `${new URL(resource).origin}/.well-known/oauth-protected-resource/mcp`;

		if (url.pathname === `/.well-known/oauth-protected-resource/mcp`) {
			return Response.json({
				resource,
				authorization_servers: [`${env.SUPABASE_URL}/auth/v1`],
				bearer_methods_supported: ['header'],
			});
		}

		if (url.pathname !== '/mcp') {
			return new Response('Not Found', { status: 404 });
		}

		const authHeader = request.headers.get('Authorization');

		if (!authHeader?.startsWith('Bearer ')) {
			return new Response('Unauthorized', { status: 401, headers: { 'WWW-Authenticate': `Bearer resource_metadata="${metadataUrl}"` } });
		}

		const accessToken = authHeader.slice(7).trim();

		if (!accessToken) {
			return new Response('Unauthorized', { status: 401, headers: { 'WWW-Authenticate': `Bearer resource_metadata="${metadataUrl}"` } });
		}

		const supabase = getSupabase(env);

		const { data, error } = await supabase.auth.getUser(accessToken);

		const { data: jwtData, error: jwtError } = await supabase.auth.getClaims(accessToken);

		if (jwtError || !jwtData || data.user?.id !== env.ALLOWED_USER_ID) {
			return new Response('Forbidden', { status: 403 });
		}
		if (error || !data.user) {
			return new Response('Unauthorized', { status: 401, headers: { 'WWW-Authenticate': `Bearer resource_metadata="${metadataUrl}"` } });
		}

		const handler = createMcpHandler(() => createServer(env, accessToken));
		return handler.fetch(request);
	},
};
