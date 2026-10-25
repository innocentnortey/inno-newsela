# Checklist: Generic PRD
- Version: 1.0.0
- Track: generic-prd
- Description: A lean PRD interview for ordinary apps, tools, and services.

## Phase 1: Problem & Users
### problem
- Prompt: What problem does this solve, and why now? Who feels the pain?
- Required: true
- Section: problem-objective

### users
- Prompt: Who are the primary users, and what's their context?
- Required: true
- Section: users-scope

### scope
- Prompt: What's explicitly in scope for v1 — and what's out?
- Required: true
- Section: users-scope

### audience-tone
- Prompt: Reading level or age range, accessibility needs, and any terminology to use or avoid?
- Required: false
- Default: general audience; no reading-level, accessibility, or terminology constraints
- Section: audience-tone-constraints

### motion-profile
- Prompt: Which motion profile fits — product (restrained app UI), marketing (a landing page that can be expressive), game (playful, overshoot is correct), or editorial (reading-first, motion serves the text)?
- Required: false
- Default: product — restrained app-UI motion
- Section: motion-profile

## Phase 2: Requirements
### functional
- Prompt: What are the core things a user must be able to do? (list the key flows)
- Required: true
- Section: functional-requirements

### acceptance
- Prompt: For each core flow, how do we know it works? (one testable check per flow)
- Required: true
- Section: acceptance-criteria

### nfr
- Prompt: Any non-functional needs — performance, scale, security, accessibility?
- Required: false
- Default: reasonable defaults for a small app (fast enough, single-region, standard auth)
- Section: non-functional-requirements

## Phase 3: Delivery
### architecture
- Prompt: Rough shape of the system — main components, data, external services?
- Required: false
- Default: infer from the stack the user already uses; revisit if complexity grows
- Section: system-architecture

### risks
- Prompt: Biggest risks or open questions that could sink this?
- Required: false
- Default: none flagged; capture as they surface
- Section: open-questions
