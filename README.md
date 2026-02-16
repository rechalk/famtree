# FamTree

A production-quality family tree web app built with Next.js. Create, visualize, and collaborate on family trees with an interactive canvas, relationship mapping, and role-based sharing.

## Features

- **Interactive Tree Visualization** — ReactFlow canvas with dagre auto-layout, pan/zoom, minimap
- **People Management** — Full CRUD with photos, bios, birth/death years, nicknames, privacy flags
- **Unlimited Relationships** — Parent-child (biological/adoptive/step/foster) and spouse (married/partner/divorced) links
- **Collaboration** — Role-based access (Owner / Editor / Viewer) per family space
- **Invite Links** — Token-based invitations with 7-day expiry
- **Search** — Filter people by name across all fields
- **PNG Export** — Download your tree as an image
- **Focus Mode** — BFS traversal to show ancestors or descendants of a selected person
- **Color-Coded Edges** — Blue (paternal), pink (maternal), green dashed (spouse), purple dashed (adoptive)
- **Privacy Controls** — Per-person privacy flags and email hashing

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS v4 |
| Database | Prisma 6 + SQLite |
| Auth | NextAuth v5 (beta) |
| Tree Canvas | ReactFlow + dagre |
| Image Processing | Sharp |

## Quick Start

**Prerequisites:** Node.js 18+

```bash
git clone <repo-url> famtree
cd famtree
npm install
npm run setup    # Generates Prisma client, pushes schema, seeds database
npm run dev      # Starts dev server at http://localhost:3000
```

**Demo login:** `demo@famtree.dev` (any email works in dev mode)

The seed creates a "Carter Family" space with 15 people across 4 generations.

## Architecture

```
src/
├── app/                    # Next.js App Router pages & API routes
│   ├── page.tsx            # Dashboard / landing
│   ├── login/              # Auth page
│   ├── space/[spaceId]/    # Family space view (main UI)
│   ├── invite/[token]/     # Invite acceptance
│   └── api/                # Auth + upload endpoints
├── components/
│   ├── tree/               # FamilyTreeCanvas (ReactFlow)
│   ├── people/             # PersonCard, PersonForm
│   └── ui/                 # Button, Modal, Drawer
├── lib/
│   ├── auth.ts             # NextAuth configuration
│   ├── actions.ts          # Server actions (all data mutations)
│   ├── prisma.ts           # Prisma client singleton
│   └── utils.ts            # Helpers (cn, maskEmail, hashEmail)
└── types/                  # TypeScript declarations
prisma/
├── schema.prisma           # Database schema
└── seed.ts                 # Demo data seeder
```

**Data flow:** Client components call server actions (`src/lib/actions.ts`) which authenticate via NextAuth, validate permissions, and interact with Prisma. The tree canvas receives data as props from a server component.

## Tree Layout

The tree uses the **dagre** algorithm for hierarchical graph layout:

1. Each person becomes a node; each relationship becomes an edge
2. Dagre computes x/y positions optimizing for minimal edge crossings
3. Parent-child edges flow top-to-bottom; spouse edges are horizontal dashed lines
4. **Focus mode** uses BFS from a selected person to show only ancestors, descendants, or both
5. Branches can be collapsed/expanded interactively

Edge colors:
- **Blue** — Paternal line
- **Pink** — Maternal line
- **Green dashed** — Spouse/partner
- **Purple dashed** — Adoptive relationship

## Security

- Email addresses are hashed (SHA-256) and masked in the UI
- All server actions verify authentication and role-based permissions
- Invite tokens are cryptographically random with 7-day expiry
- Image uploads validated for type (JPEG/PNG/WebP/GIF) and size (5MB max)
- Credentials provider is dev-only; replace with OAuth/magic links for production

## Database

Models: **User**, **FamilySpace**, **Membership** (role-based), **Person**, **Relationship** (typed + subtyped), **Invitation**

Browse the database:
```bash
npm run db:studio
```

## Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Production build |
| `npm run start` | Start production server |
| `npm run setup` | Generate Prisma + push schema + seed |
| `npm run db:push` | Push schema changes to database |
| `npm run db:seed` | Seed database with demo data |
| `npm run db:studio` | Open Prisma Studio (DB browser) |
| `npm run db:reset` | Reset database and re-seed |

## Deployment

**Vercel (recommended):**

1. Push to GitHub
2. Import in Vercel
3. Set environment variables:
   - `AUTH_SECRET` — Random string (`openssl rand -base64 32`)
   - `AUTH_URL` — Your production URL
   - `DATABASE_URL` — Connection string

**Production considerations:**
- Replace SQLite with PostgreSQL (update `provider` in `schema.prisma`)
- Replace credentials auth with OAuth (Google, GitHub) or magic links (Resend)
- Add rate limiting on API routes
- Configure image storage (S3/Cloudinary instead of local uploads)

## Future Improvements

- GEDCOM import/export for interoperability with genealogy software
- Timeline view showing family events chronologically
- Photo albums per person
- Real-time collaboration with live cursors
- Family statistics dashboard (age distribution, geographic spread)
- PDF report generation
- Multi-language support
