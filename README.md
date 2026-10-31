# Setwise MCP Server

An MCP (Model Context Protocol) server that connects AI assistants to [Setwise](https://setwise.yaryhin.com), a workout tracking application.

Built with **TypeScript, Cloudflare Workers, MCP SDK, and Supabase**.

## Overview

Setwise MCP allows compatible AI assistants to interact with a user's workout data through the Model Context Protocol.

The goal is to simplify workout management by letting users manage exercises and routines through natural language.

## Features

- **Exercise Search** — Retrieve and search exercises from a user's Setwise account.
- **Routine Creation** — Create workout routines using existing exercises.
- **Supabase Integration** — Access user-specific data stored in PostgreSQL.
- **OAuth Authentication** — Secure access through Supabase Auth.
- **MCP Compatibility** — Expose tools to compatible AI clients.

## Tech Stack

- TypeScript
- Cloudflare Workers
- Model Context Protocol (MCP) SDK
- Supabase (PostgreSQL + Authentication)
- Zod for tool input validation

## Architecture

```text
AI Assistant / MCP Client
          |
          v
     MCP Server
  (Cloudflare Worker)
          |
          v
   Authentication
    (Supabase Auth)
          |
          v
     Supabase API
          |
          v
   PostgreSQL Database
```

The server uses Supabase authentication to ensure operations are performed within the authenticated user's account.

## Available Tools

### `search_exercises`

Searches for exercises belonging to the authenticated user.

### Routine Creation

Creates a workout routine using existing exercise IDs.

Routine creation is handled through the PostgreSQL function `create_routine_with_exercises`, which creates the routine and its exercise associations.

## Authentication

The server implements OAuth-based authorization using Supabase Auth.

- OAuth protected-resource metadata discovery
- Bearer token authentication
- User authorization through the Setwise consent page
- User-specific database access

Protected-resource metadata is exposed at:

```text
/.well-known/oauth-protected-resources/mcp
```

MCP endpoint:

```text
/mcp
```

## Local Development

Install dependencies:

```bash
npm install
```

Start the development server:

```bash
npx wrangler dev
```

The MCP endpoint is available locally at:

```text
http://127.0.0.1:8787/mcp
```

Use [MCP Inspector](https://github.com/modelcontextprotocol/inspector) to test tool execution and authentication.

## Project Status

**Under active development.**

Core MCP functionality, Supabase integration, routine creation, and OAuth authentication have been implemented and tested locally.

Cloudflare Workers production deployment and additional workout management capabilities are planned.

## Related Project

[Setwise — Workout Tracker](https://setwise.yaryhin.com)
