# Setwise MCP Server

**Connect AI assistants to your workouts using the Model Context Protocol.**

Setwise MCP is a remote MCP server that allows compatible AI assistants, including ChatGPT, to securely interact with [Setwise](https://setwise.yaryhin.com), a workout tracking web application.

Built with **TypeScript, Cloudflare Workers, Supabase, PostgreSQL, and the official MCP SDK**.

[Setwise App](https://setwise.yaryhin.com) · [MCP Server](https://setwise-mcp-dev.aderhilyt.workers.dev/mcp)

## Overview

Setwise MCP extends the Setwise workout tracker with natural-language interactions.

Instead of manually navigating the application to find exercises or build routines, users can connect a compatible AI assistant and ask it to perform supported actions on their behalf.

For example:

> "Find my available chest exercises and create a push-day routine with three of them."

The assistant discovers available exercises, selects their IDs, and creates a routine directly in the user's Setwise account.

The integration uses the existing Setwise database and authentication system, without requiring a separate AI model or duplicating the frontend's functionality.

## Features

- **Exercise Search** — Retrieve and search exercises belonging to the authenticated user.
- **Routine Creation** — Create workout routines with existing exercises in a specified order.
- **OAuth 2.1 Authorization** — Connect AI clients through Supabase Auth and the Setwise consent page.
- **User-Specific Data Access** — Use authenticated Supabase sessions and Row Level Security (RLS).
- **Atomic Database Operations** — Create routines and exercise associations in a single PostgreSQL transaction.
- **Cloud Deployment** — Run the MCP server on Cloudflare Workers using Streamable HTTP.
- **Input Validation** — Validate tool arguments with Zod.

## Tech Stack

| Technology | Purpose |
|---|---|
| TypeScript | Server implementation |
| Cloudflare Workers | Serverless hosting |
| MCP SDK | Tool registration and protocol handling |
| Supabase Auth | OAuth 2.1 and user authentication |
| PostgreSQL | Workout data and transactional operations |
| Supabase JS | Database access |
| Zod | Runtime input validation |

## Architecture

```text
ChatGPT / MCP-compatible AI Client
                |
                | OAuth 2.1
                v
         Supabase Auth
                |
                | User approval
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

The MCP server operates independently of the Setwise React frontend. Both use the same Supabase project and underlying data.

## Available MCP Tools

### `search_exercises`

**Read-only**

Retrieves exercises belonging to the authenticated user, optionally filtering by name.

Input:

```json
{
  "query": "bench"
}
```

The `query` argument is optional. Results include exercise IDs, names, and categories, with a maximum of 50 exercises per request.

### `create_routine`

**Write operation**

Creates a new workout routine from existing exercise IDs.

Input:

```json
{
  "name": "Push Day",
  "exercise_ids": [
    "exercise-uuid-1",
    "exercise-uuid-2",
    "exercise-uuid-3"
  ]
}
```

The tool validates its input and invokes the PostgreSQL function `create_routine_with_exercises`.

This function:

1. Identifies the authenticated user.
2. Validates the selected exercises and their ownership.
3. Calculates the exercise count and unique categories.
4. Creates the routine.
5. Creates the routine-exercise associations in the requested order.
6. Returns the new routine ID.

All database writes occur within a single transaction. If an operation fails, the changes are rolled back.

## Authentication & Security

Setwise MCP integrates with Supabase OAuth 2.1.

The authorization flow includes:

1. OAuth discovery through protected-resource metadata.
2. Authorization through Supabase Auth.
3. User consent through the Setwise frontend.
4. Access-token verification by the MCP server.
5. Authenticated database operations protected by Supabase RLS.

The server never accepts a user ID as an AI-generated tool argument. User identity is determined from the authenticated session.

The development deployment also restricts access to an explicitly configured Setwise user.

**Current limitation:** Supabase OAuth access tokens use a general `authenticated` audience. Resource-specific OAuth audience binding is not yet enforced. The remote integration is therefore in restricted development and should not be treated as a production-ready, multi-user authorization system.

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

Clone the repository:

```bash
git clone https://github.com/yaryhiin/setwise-mcp.git
cd setwise-mcp
npm install
```

Create a `.dev.vars` file in the project root and configure the required local environment bindings:

```dotenv
SUPABASE_URL="YOUR_SUPABASE_URL"
SUPABASE_PUBLISHABLE_KEY="YOUR_PUBLISHABLE_KEY"
MCP_RESOURCE_URL="http://127.0.0.1:8787/mcp"
ALLOWED_USER_ID="YOUR_TEST_USER_UUID"
```

Do not commit `.dev.vars` or private credentials to Git.

Start the Worker:

```bash
npm run dev
```

For local testing, launch MCP Inspector:

```bash
npx @modelcontextprotocol/inspector@latest
```

Connect using the Streamable HTTP transport at:

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

Cloudflare Workers provides an on-demand execution environment without requiring a continuously running traditional server.

## Project Status

**Active development — deployed and functionally tested.**

Completed:

- Remote MCP server with Streamable HTTP
- Supabase integration
- Exercise search
- Transactional routine creation
- OAuth 2.1 authorization flow
- Setwise consent page
- Cloudflare Workers deployment
- End-to-end testing with MCP Inspector
- End-to-end tool execution from ChatGPT
- Restricted user access

Planned:

- Workout history retrieval
- Exercise performance and progression analysis
- Additional routine management tools
- Resource-bound OAuth token validation
- Production-ready multi-user access

## Related Project

**[Setwise — Workout Tracker](https://setwise.yaryhin.com)**

A workout tracking application built with React, TypeScript, and Supabase, focused on simplifying workout logging, routine management, and tracking training progression.

---

*Setwise MCP is an independently developed extension of Setwise, designed to make workout management accessible through compatible AI assistants.*