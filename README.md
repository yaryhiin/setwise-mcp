# Setwise MCP Server

**Connect AI assistants to your workouts using the Model Context Protocol.**

Setwise MCP is a remote MCP server that enables compatible AI assistants, including ChatGPT, to securely interact with [Setwise](https://setwise.yaryhin.com), a workout tracking application.

Built with **TypeScript, Cloudflare Workers, Supabase, PostgreSQL, and the MCP SDK**.

[Setwise App](https://setwise.yaryhin.com) · [MCP Server](https://setwise-mcp-dev.aderhilyt.workers.dev/mcp)

## Overview

Setwise MCP extends the Setwise workout tracker with natural-language interactions, allowing users to manage training data without manually navigating the application.

Users can ask an AI assistant to:

- Search their exercise library.
- Create and update workout routines.
- Configure exercise targets, including sets and rep ranges.
- Retrieve existing routines and their exercise details.
- Access completed workouts, including recorded sets, weights, and repetitions.

For example:

> "Update all five of my workout routines with the sets and rep ranges from this training plan."

The assistant can retrieve existing routines, match exercise IDs, and update their targets directly through Setwise.

The integration uses the existing Setwise authentication system and database without requiring a separate AI model or duplicating the application's frontend functionality.

## Features

- **Exercise Search** — Find exercises belonging to the authenticated user.
- **Routine Management** — Create, retrieve, and update routines while preserving exercise order.
- **Exercise Targets** — Configure optional set counts and minimum/maximum repetition targets.
- **Workout History** — Retrieve completed workouts using date filters and pagination.
- **Workout Details** — Access recorded exercises, weights, repetitions, rest periods, and set completion data.
- **OAuth 2.1 Authorization** — Connect compatible AI clients through Supabase Auth and the Setwise consent page.
- **User-Specific Data Access** — Protect database operations through authenticated Supabase sessions and Row Level Security (RLS).
- **Transactional Database Operations** — Manage routine creation and updates through PostgreSQL functions.
- **Cloud Deployment** — Run the MCP server on Cloudflare Workers using Streamable HTTP.
- **Input Validation** — Validate tool arguments using Zod.

## Tech Stack

| Technology | Purpose |
|---|---|
| TypeScript | Server implementation |
| Cloudflare Workers | Serverless deployment |
| MCP SDK | Protocol handling and tool registration |
| Supabase Auth | OAuth 2.1 and user authentication |
| PostgreSQL | Workout data and database operations |
| Supabase JS | Database access |
| Zod | Runtime input validation |
| Vitest | Automated testing |

## Architecture

```text
ChatGPT / MCP-compatible AI Client
                |
                | OAuth 2.1
                v
         Supabase Auth
                |
                | User consent
                v
      Setwise Consent Page
                |
                | Access token
                v
        Setwise MCP Server
        (Cloudflare Workers)
                |
                | Authenticated requests
                v
          Supabase API
                |
                | RLS policies
                v
         PostgreSQL Database
```

The MCP server operates independently of the Setwise React frontend. Both applications use the same Supabase project and underlying data.

## Available MCP Tools

The server currently exposes **7 tools**: five read-only operations and two write operations.

### `search_exercises`

**Read-only**

Searches the authenticated user's exercise library by name.

```json
{
  "query": "bench"
}
```

The `query` parameter is optional. Returns up to 50 exercises, including IDs, names, and categories.

### `get_routines`

**Read-only**

Lists up to 50 routines belonging to the authenticated user.

Returns routine IDs, names, exercise counts, and exercise categories.

### `get_routine_details`

**Read-only**

Retrieves a specific routine and its exercises in the saved order.

```json
{
  "routine_id": "routine-uuid"
}
```

Returns exercise IDs, names, categories, and optional targets (`sets`, `min_reps`, `max_reps`).

### `create_routine`

**Write operation**

Creates a workout routine using existing exercise IDs, with optional sets and repetition targets.

```json
{
  "name": "Push Day",
  "exercises": [
    {
      "id": "exercise-uuid-1",
      "sets": 3,
      "min_reps": 8,
      "max_reps": 10
    },
    {
      "id": "exercise-uuid-2",
      "sets": 4,
      "min_reps": 10,
      "max_reps": 12
    }
  ]
}
```

Uses the PostgreSQL function `create_routine_with_exercises` to validate exercises, calculate routine metadata, and save the routine and its exercise associations transactionally.

Exercise order is preserved.

### `update_routine`

**Write operation**

Updates an existing routine, including its name, exercises, order, and optional training targets.

```json
{
  "routine_id": "routine-uuid",
  "name": "Updated Push Day",
  "exercises": [
    {
      "id": "exercise-uuid-1",
      "sets": 4,
      "min_reps": 6,
      "max_reps": 8
    }
  ]
}
```

Uses the PostgreSQL function `update_routine_with_exercises`.

**Important:** This operation replaces the routine's existing exercise associations with the supplied list. Exercises that should remain in the routine must be included in the request.

### `get_workouts`

**Read-only**

Retrieves the authenticated user's workout history, ordered by most recent first.

Supports optional date filtering and pagination.

```json
{
  "start_date": "2026-10-01",
  "end_date": "2026-11-01",
  "limit": 30,
  "offset": 0
}
```

The end date is exclusive.

By default, returns the 30 most recent workouts. Results include workout IDs, names, durations, and start times.

### `get_workout_details`

**Read-only**

Retrieves detailed information about a specific completed workout.

```json
{
  "workout_id": "workout-uuid"
}
```

Returns workout metadata and recorded exercises, including:

- Exercise names, categories, and order
- Exercise notes
- Set numbers
- Recorded weights and repetitions
- Rest durations
- Set completion status

This allows compatible AI assistants to inspect actual training data and help users review workout performance.

## Authentication & Security

Setwise MCP integrates with Supabase OAuth 2.1.

The authorization flow includes:

1. OAuth discovery through protected-resource metadata.
2. Authentication through Supabase Auth.
3. User consent through the Setwise frontend.
4. Access-token verification by the MCP server.
5. Authenticated database operations protected by Supabase RLS.

User identity is determined from the authenticated access token rather than supplied as an AI-generated tool argument.

The current development deployment also restricts access to an explicitly configured Setwise user.

**Current limitation:** Supabase OAuth access tokens use a general `authenticated` audience. Resource-specific OAuth audience binding is not yet enforced. The remote integration remains restricted to development use and should not be considered a production-ready multi-user authorization system.

## Endpoints

**Remote MCP server**

```text
https://setwise-mcp-dev.aderhilyt.workers.dev/mcp
```

**Protected-resource metadata**

```text
/.well-known/oauth-protected-resource/mcp
```

**Local MCP server**

```text
http://127.0.0.1:8787/mcp
```

Transport: **Streamable HTTP**

## Local Development

### Prerequisites

- Node.js and npm
- A Supabase project
- A Cloudflare account
- An MCP-compatible testing client

### Installation

Clone the repository and install dependencies:

```bash
git clone https://github.com/yaryhiin/setwise-mcp.git
cd setwise-mcp
npm install
```

Create a `.dev.vars` file in the project root:

```dotenv
SUPABASE_URL="YOUR_SUPABASE_URL"
SUPABASE_PUBLISHABLE_KEY="YOUR_PUBLISHABLE_KEY"
MCP_RESOURCE_URL="http://127.0.0.1:8787/mcp"
ALLOWED_USER_ID="YOUR_TEST_USER_UUID"
```

Do not commit `.dev.vars` or private credentials.

Start the development server:

```bash
npm run dev
```

Launch MCP Inspector:

```bash
npx @modelcontextprotocol/inspector@latest
```

Connect using the Streamable HTTP transport:

```text
http://127.0.0.1:8787/mcp
```

Authentication requires an authorized Setwise account.

## Deployment

The MCP server is deployed using Cloudflare Workers.

```bash
npm run deploy
```

Production bindings and access restrictions must be configured in Cloudflare before enabling authenticated tool execution.

Cloudflare Workers provides an on-demand serverless execution environment without requiring a continuously running traditional server.

## Project Status

**Active development — deployed and functionally tested with ChatGPT.**

### Implemented

- Remote MCP server with Streamable HTTP
- Supabase OAuth 2.1 integration and consent page
- Exercise search
- Routine listing and detailed retrieval
- Transactional routine creation and updates
- Optional exercise sets and rep-range targets
- Workout history with filtering and pagination
- Detailed workout and recorded-set retrieval
- Cloudflare Workers deployment
- End-to-end tool execution through ChatGPT
- Restricted user access

### Planned

- Exercise-specific performance history
- AI-assisted progression and training analysis
- Additional workout and routine management capabilities
- Resource-bound OAuth token validation
- Production-ready multi-user access

## Related Project

**[Setwise — Workout Tracker](https://setwise.yaryhin.com)**

A workout tracking application built with React, TypeScript, and Supabase, focused on simplifying workout logging, routine management, and tracking training progression.

---

*Setwise MCP is an independently developed extension of Setwise, designed to make workout management accessible through compatible AI assistants.*