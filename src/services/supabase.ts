import { createClient } from '@supabase/supabase-js';

export interface Env {
	SUPABASE_URL: string;
	SUPABASE_PUBLISHABLE_KEY: string;
	MCP_RESOURCE_URL: string;
	ALLOWED_USER_ID: string;
	
}

export function getSupabase(env: Env, accessToken?: string) {
	return createClient(env.SUPABASE_URL, env.SUPABASE_PUBLISHABLE_KEY, {
		auth: {
			persistSession: false,
			autoRefreshToken: false,
		},
		...(accessToken && {
			global: {
				headers: {
					Authorization: `Bearer ${accessToken}`,
				},
			},
		}),
	});
}
