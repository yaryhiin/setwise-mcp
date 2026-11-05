import { McpServer, createMcpHandler } from '@modelcontextprotocol/server';
import { getSupabase } from './services/supabase';
import { success, z } from 'zod';

import type { Env } from './services/supabase';

function createServer(env: Env, accessToken: string) {
	const server = new McpServer({ name: 'setwise-mcp', version: '1.0.0' });

	server.registerTool(
		'search_exercises',
		{
			description:
				'Find available exercises by name. Returns exercise IDs, names and categories. Use this tool to find valid exercises before creating a routine',
			annotations: {
				readOnlyHint: true,
				destructiveHint: false,
				openWorldHint: false,
			},
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
		'get_workouts',
		{
			description:
				'Find user`s workouts inside date range(end date is not inclusive) with offset and limit. Returns workout ids, name, duration and started_at. Use this tool to find valid workouts before retrieving their details. Workouts are ordered by started_at descending. If no data is provided, the last 30 workouts are returned.',
			annotations: {
				readOnlyHint: true,
				destructiveHint: false,
				openWorldHint: false,
			},
			inputSchema: z.object({
				limit: z.number().int().min(1).max(100).default(30),
				offset: z.number().int().min(0).default(0),
				start_date: z.iso.date().optional(),
				end_date: z.iso.date().optional(),
			}),
		},
		async ({ limit, offset, start_date, end_date }) => {
			const supabase = getSupabase(env, accessToken);

			let request = supabase
				.from('workouts')
				.select('id, name, duration_seconds, started_at')
				.order('started_at', { ascending: false })
				.order('id', { ascending: false })
				.range(offset, offset + limit - 1);

			if (start_date) {
				request = request.gte('started_at', start_date);
			}

			if (end_date) {
				request = request.lt('started_at', end_date);
			}

			const { data, error } = await request;

			if (error) {
				return {
					isError: true,
					content: [{ type: 'text', text: error.message }],
				};
			}

			return { content: [{ type: 'text', text: JSON.stringify(data) }] };
		},
	);

	server.registerTool(
		'get_workout_details',
		{
			description:
				'Get details of a specific workout by its ID. Returns workout name, duration, started_at, exercise and their sets data performed in the workout.',
			annotations: {
				readOnlyHint: true,
				destructiveHint: false,
				openWorldHint: false,
			},
			inputSchema: z.object({ workout_id: z.string().uuid() }),
		},
		async ({ workout_id }) => {
			const supabase = getSupabase(env, accessToken);

			const { data, error } = await supabase
				.from('workouts')
				.select(
					`
      name, duration_seconds, started_at,
      workout_exercises (
        exercise_name, category, order_index, notes, exercise_id,
        workout_sets (set_number, weight, reps, rest_seconds, done)
      )
    `,
				)
				.eq('id', workout_id)
				.order('order_index', { referencedTable: 'workout_exercises', ascending: true })
				.order('set_number', {
					referencedTable: 'workout_exercises.workout_sets',
					ascending: true,
				})
				.single();

			if (error) {
				return {
					isError: true,
					content: [{ type: 'text', text: error.message }],
				};
			}

			return {
				content: [{ type: 'text', text: JSON.stringify(data) }],
			};
		},
	);

	server.registerTool(
		'get_routines',
		{
			description:
				'List up to 50 user routines. Returns routine IDs, names, exercise count and categories of exercises used in this routine. Use this tool to find valid routines before updating them',
			annotations: {
				readOnlyHint: true,
				destructiveHint: false,
				openWorldHint: false,
			},
			inputSchema: z.object({}),
		},
		async ({}) => {
			const supabase = getSupabase(env, accessToken);

			const { data, error } = await supabase.from('routines').select('id, name, exercises_count, categories').order('name').limit(50);

			if (error) {
				return {
					isError: true,
					content: [{ type: 'text', text: error.message }],
				};
			}

			return {
				content: [
					{
						type: 'text' as const,
						text: JSON.stringify(data),
					},
				],
			};
		},
	);

	server.registerTool(
		'get_routine_details',
		{
			description:
				'Get details of a specific routine by its ID. Returns routine name, exercise data with optional targets(sets, min/max reps) data, if available.',
			annotations: {
				readOnlyHint: true,
				destructiveHint: false,
				openWorldHint: false,
			},
			inputSchema: z.object({ routine_id: z.string().uuid() }),
		},
		async ({ routine_id }) => {
			const supabase = getSupabase(env, accessToken);

			const { data, error } = await supabase
				.from('routines')
				.select(`name, routine_exercises (exercise_id, order_index, sets, min_reps, max_reps, exercises (name, category))`)
				.eq('id', routine_id)
				.order('order_index', { referencedTable: 'routine_exercises', ascending: true })
				.single();

			if (error) {
				return {
					isError: true,
					content: [{ type: 'text', text: error.message }],
				};
			}

			return {
				content: [{ type: 'text', text: JSON.stringify(data) }],
			};
		},
	);

	server.registerTool(
		'create_routine',
		{
			description:
				'Creates a workout routine for the authenticated user using existing exercise IDs, optional set numbers and min_reps - max_reps rep range. Use search_exercises first to find valid IDs. Exercise order is preserved.',
			annotations: {
				readOnlyHint: false,
				idempotentHint: false,
				destructiveHint: false,
				openWorldHint: false,
			},
			inputSchema: z.object({
				name: z.string().trim().min(1).max(100),
				exercises: z
					.array(
						z.object({
							id: z.uuid(),
							sets: z.int().min(1).max(32767).nullish(),
							min_reps: z.int().min(1).max(32767).nullish(),
							max_reps: z.int().min(1).max(32767).nullish(),
						}),
					)
					.min(1)
					.max(50),
			}),
		},
		async ({ name, exercises }) => {
			const supabase = getSupabase(env, accessToken);

			const { data, error } = await supabase.rpc('create_routine_with_exercises', { p_name: name, p_exercises: exercises });

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

	server.registerTool(
		'update_routine',
		{
			description:
				'Updates an existing workout routine for the authenticated user by deleting old exercises from routine and using existing exercise IDs to replace them, optional set numbers and min_reps - max_reps rep range. Use search_exercises first to find valid IDs. Exercise order is preserved.',
			annotations: {
				readOnlyHint: false,
				idempotentHint: false,
				destructiveHint: false,
				openWorldHint: false,
			},
			inputSchema: z.object({
				routine_id: z.string().uuid(),
				name: z.string().trim().min(1).max(100),
				exercises: z
					.array(
						z.object({
							id: z.uuid(),
							sets: z.int().min(1).max(32767).nullish(),
							min_reps: z.int().min(1).max(32767).nullish(),
							max_reps: z.int().min(1).max(32767).nullish(),
						}),
					)
					.min(1)
					.max(50),
			}),
		},
		async ({ routine_id, name, exercises }) => {
			const supabase = getSupabase(env, accessToken);

			const { data, error } = await supabase.rpc('update_routine_with_exercises', {
				p_routine_id: routine_id,
				p_name: name,
				p_exercises: exercises,
			});

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
