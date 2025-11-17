# AI Memory System - Migration Guide

## Overview

This guide documents the migration from MongoDB to Neo4j and the integration of Supabase for authentication and multi-user support.

## What's Been Completed

### ✅ Phase 1: Neo4j Migration

1. **Installed neo4j-driver** package
2. **Created Neo4j service layer** (`app/lib/services/neo4j.ts`)
   - Connection management using singleton pattern
   - `executeRead()` and `executeWrite()` helper functions
   - Session management with automatic cleanup
3. **Migrated Memory Service** (`app/lib/services/memory.ts`)
   - All CRUD operations now use Cypher queries
   - Supports user ownership via `(:User)-[:OWNS]->(:Memory)` relationships
   - Namespace filtering for multi-tenant isolation
4. **Migrated Relationship Service** (`app/lib/services/relationship.ts`)
   - Native Neo4j relationships: `[:UPDATES]`, `[:EXTENDS]`, `[:DERIVES]`
   - Automatic status updates for superseded memories
5. **Updated All API Routes**
   - `/api/memories` - Create and list memories
   - `/api/memories/[id]` - Get single memory
   - `/api/memories/graph` - Graph visualization data
   - `/api/memories/[id]/lineage` - Memory lineage traversal
   - `/api/memories/[id]/relationships` - Relationship management
   - `/api/search` - Semantic search (Pinecone + Neo4j)
   - `/api/derive` - Derive insights from multiple memories
6. **Removed MongoDB** - Deleted mongodb.ts and removed mongodb package

### ✅ Phase 2: Supabase Integration (Partial)

1. **Installed Supabase packages** (`@supabase/supabase-js`, `@supabase/ssr`)
2. **Created Database Schema** (`supabase/migrations/001_initial_schema.sql`)
   - `profiles` table for user metadata
   - `namespaces` table for multi-tenant isolation
   - `user_settings` table for user preferences
   - Row Level Security (RLS) policies
   - Automatic profile/namespace creation on signup
3. **Created Supabase Client Utilities**
   - Server client (`app/lib/services/supabase.ts`)
   - Browser client (`app/lib/supabase/client.ts`)
   - Middleware (`app/lib/supabase/middleware.ts`)
4. **Created Authentication Pages**
   - Login page (`app/auth/login/page.tsx`)
   - Signup page (`app/auth/signup/page.tsx`)
   - OAuth callback handler (`app/auth/callback/route.ts`)
5. **Created Auth Components**
   - `AuthProvider` for client-side auth state
   - `Header` component with login/logout
   - Auth middleware for API routes
6. **Updated Frontend**
   - Root layout wrapped with `AuthProvider`
   - Main page requires authentication
   - API client includes auth tokens in requests
7. **Updated Types** - Added User, Profile, Namespace, UserSettings types
8. **Updated Pinecone** - Added namespace support for multi-tenancy

## Required Environment Variables

Create a `.env.local` file with the following variables:

```env
# Neo4j Configuration (REQUIRED)
NEO4J_URI=bolt://your-neo4j-url:7687
NEO4J_USERNAME=neo4j
NEO4J_PASSWORD=your_neo4j_password

# Supabase Configuration (REQUIRED)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Pinecone Configuration (REQUIRED)
PINECONE_API_KEY=your_pinecone_api_key
PINECONE_INDEX_NAME=ai-memory

# OpenAI Configuration (REQUIRED for embeddings/LLM)
OPENAI_API_KEY=your_openai_api_key

# Optional: Cohere (alternative to OpenAI)
# COHERE_API_KEY=your_cohere_api_key
```

## Setup Instructions

### 1. Neo4j Setup

1. Create a Neo4j database (local or Aura cloud)
2. Note the connection URI, username, and password
3. Add to `.env.local`

### 2. Supabase Setup

1. Create a Supabase project at https://supabase.com
2. Go to Project Settings > API to find:
   - Project URL (`NEXT_PUBLIC_SUPABASE_URL`)
   - Anon/Public Key (`NEXT_PUBLIC_SUPABASE_ANON_KEY`)
   - Service Role Key (`SUPABASE_SERVICE_ROLE_KEY`)
3. Run the migration SQL:
   ```bash
   # In Supabase Dashboard: SQL Editor > New Query
   # Copy and paste contents of supabase/migrations/001_initial_schema.sql
   # Click "Run"
   ```

### 3. Pinecone Setup

1. Create a Pinecone account and index
2. Get your API key from dashboard
3. Add to `.env.local`

### 4. Install Dependencies

```bash
npm install
```

### 5. Run the Application

```bash
npm run dev
```

## Architecture

```
┌─────────────────┐
│  Next.js Client │
│   (React)       │
└────────┬────────┘
         │
         │ Auth: Supabase JWT
         │ API: /api/*
         │
┌────────▼─────────────────┐
│  Next.js API Routes      │
│  - Auth Middleware       │
│  - Namespace Isolation   │
└────────┬─────────────────┘
         │
    ┌────┴────┬────────┬────────┐
    │         │        │        │
┌───▼───┐ ┌──▼───┐ ┌──▼────┐ ┌─▼──────┐
│Supabase│ │Neo4j │ │Pinecone│ │OpenAI  │
│(Auth)  │ │(Graph)│ │(Vector)│ │(LLM)   │
└────────┘ └──────┘ └────────┘ └────────┘
```

## What Still Needs To Be Done

### TODO: Integrate Auth into API Routes

The API routes need to be updated to:
1. Use `requireAuth()` middleware to verify user authentication
2. Get user's namespace from Supabase
3. Pass `userId` and `namespace` to memory/relationship service functions

**Example pattern:**

```typescript
import { requireAuth, isErrorResponse } from '@/app/lib/middleware/auth';
import { ensureUserNamespace } from '@/app/lib/services/supabase';

export async function POST(request: NextRequest) {
  // Authenticate user
  const authResult = await requireAuth(request);
  if (isErrorResponse(authResult)) {
    return authResult; // Return 401 error
  }
  
  const { userId } = authResult;
  
  // Get user's namespace
  const namespace = await ensureUserNamespace(userId);
  
  // Use in service calls
  const memory = await createMemory(data, userId, namespace.graphNamespace);
  
  return NextResponse.json(memory);
}
```

### TODO: Create Profile and Settings Pages

- `app/profile/page.tsx` - Display and edit user profile
- `app/settings/page.tsx` - Manage user settings, namespaces
- API routes for updating settings

### TODO: Final Testing

- Test signup/login flows
- Test memory creation with authentication
- Test multi-user isolation (create multiple accounts)
- Verify namespace filtering works in Neo4j and Pinecone

## Key Changes from Original Design

1. **No Classes** - All services use functional programming (interfaces/types only)
2. **Namespace Filtering** - All Neo4j queries support optional namespace parameter
3. **User Ownership** - Neo4j stores `(:User)-[:OWNS]->(:Memory)` relationships
4. **Pinecone Namespaces** - Pinecone operations use namespace parameter for isolation
5. **JWT Auth** - Supabase JWT tokens passed as Bearer tokens to API routes

## Testing the Migration

1. **Sign up** at `/auth/signup`
2. **Sign in** at `/auth/login`
3. **Create memories** - Should be isolated to your namespace
4. **Search** - Should only find your memories
5. **View graph** - Should only show your memory graph

## Troubleshooting

### Connection Errors

- **Neo4j:** Verify `NEO4J_URI`, `NEO4J_USERNAME`, `NEO4J_PASSWORD`
- **Supabase:** Check project URL and API keys
- **Pinecone:** Confirm API key and index name

### Authentication Issues

- Clear browser cookies and try again
- Check Supabase dashboard for user creation
- Verify RLS policies are enabled

### Memory Not Showing

- Check browser console for API errors
- Verify auth token is being sent (Network tab)
- Check Neo4j database for actual data

## Next Steps

1. Complete auth integration in all API routes
2. Create profile and settings pages
3. Add comprehensive error handling
4. Implement proper logging
5. Add rate limiting and security headers
6. Deploy to production (Vercel + Neo4j Aura + Supabase)

