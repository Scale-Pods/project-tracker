# ScalePods Project Tracker

An internal dashboard that gives the ScalePods team one place to see the live status of every client project — replacing manual spreadsheet check-ins with a real-time view of health, blockers, tasks, team workload, and payouts.

## What it does

ScalePods runs an automated pipeline that listens to Fireflies meeting transcripts, extracts project updates with Claude, and writes the results straight into Supabase — status, blockers, pending tasks, milestones, and activity notes, all without a human touching a keyboard. This app is the **read surface and entry point** for that pipeline:

- **Add a project** — a short onboarding form seeds a new project, its team, and the first activity log entry.
- **Track it live** — every project's health (On Track / At Risk / Delayed), blockers, open tasks, and milestone progress update automatically as the automation pipeline writes to the database, with an AI-generated status summary rendered on each visit.
- **Close it out** — a closure flow captures the actual end date and client rating, which drives an itemized incentive payout breakdown per team member.
- **Manage the team** — dashboards for per-person project bandwidth (lead vs. support load) and weekly Saturday-off eligibility, computed from the same live task data.

The dashboard never re-interprets or overrides what the automation writes — AI-derived fields (status, blockers, tasks, remarks) are shown exactly as extracted, including a confidence flag when the pipeline itself was unsure.

## Pages

| Route | Purpose |
|---|---|
| `/projects` | Every project as a card: health, priority, stage, timeline, deal size, team, search/filter. Entry point for adding a new project. |
| `/projects/[id]` | Full detail view for one project — AI summary, timeline & milestone progress, team, blockers, pending tasks, activity log, and (once applicable) the closure/payout panel. |

## How it's built

- **Next.js 16 (App Router)** + **TypeScript**, **React 19**
- **Supabase** (Postgres) as the single source of truth — all reads/writes happen server-side via Server Components and Server Actions, using the service role key so RLS never blocks legitimate app traffic
- **Gemini API** generates the plain-language project summary shown on each detail page, computed from the same rows already fetched for the rest of the page and cached for an hour (or until the underlying data changes)
- **Tailwind CSS** for a dark, glass-surfaced design system built around ScalePods' brand indigo

```
Fireflies meeting ──▶ Claude Project ──▶ Supabase (projects, blockers,
                                                     pending_tasks, milestones, …)
                                                              │
Manual "Add Project" form ──────────────────────────────────▶│
                                                              ▼
                                              This dashboard (read + onboarding UI)
```

## Project structure

```
app/projects/            Routes: list page, detail page, and server actions
                          (add project, submit closure)
components/projects/     Feature components (cards, modals, detail sections)
components/ui/           Shared design-system primitives (badges, progress bars, skeletons)
lib/                     Supabase client, typed queries, incentive-payout math,
                          Gemini integration, validation
```