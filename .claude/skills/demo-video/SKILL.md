---
name: demo-video
description: Create a narrated demo video (MP4, under five minutes) of a web app for hiring partners, recruiters, or a portfolio. It reads the repo's PRD, design docs, and code, drives the running app in a browser with a visible cursor, voices the narration with ElevenLabs, and assembles it with ffmpeg, captions and title cards included. Use this whenever the user wants a demo video, product walkthrough, screen recording with voiceover, project showcase video, or a video for a job application, hiring partner, or Gauntlet-style project submission, even if they just say "record my project" or "make a video of this app".
compatibility: Needs shell access on a machine that can reach the app (Claude Code or Cowork, not claude.ai chat). Requires Python 3.10+, ffmpeg, and an ElevenLabs API key in .demo/.env.
---

# Demo video

You write the video and the script `scripts/demo.py` produces it. You decide what to show, write the narration, choose the clicks, verify every claim against the code, and review the result. The script crawls the app, dry-runs your clicks, generates the voice, records the browser in sync with the voice, and cuts the MP4.

Call the script by its absolute path from the **repo root**: `python <this skill's dir>/scripts/demo.py <command>`. Below, `demo.py` means that full command. Everything it writes goes in `.demo/`. `.demo/shotlist.yaml` is the reviewable source of the video and is meant to be committed. Build output, audio, video, and keys are git-ignored.

The human stays in the loop at two points. They approve the narration script before any audio is generated, because ElevenLabs costs credits and the words are theirs. And you ask before changing app source code, such as adding a `data-testid`. Everything else you can do on your own.

## 0. Gauntlet: the original, and how each project adapts it

This is the **original** (`Gauntlet AI/.claude/skills/demo-video/`). A project copies the whole folder into its own `.claude/skills/demo-video/` and adapts the copy (workspace rule 3: copy-and-adapt, not shared mutable state). `inno-cerbo` made the first recording from it (2026-10-11). Improve the original first, then re-copy; never edit one project's copy and expect the others to follow.

What to change in a project's copy, and what to leave alone:

| Leave alone | Adapt per project |
|---|---|
| `scripts/demo.py` and `requirements.txt` (the engine knows nothing about any project) | The first paragraph of this file: add the project's dev command, URL, login, and where the video must go (`docs/artifacts/YYYY-MM-DD-demo-video.mp4`) |
| The setup, key, verify, dry-run, approval and render steps | Section 2's doc list (the project's own PRD, brief, design doc names) |
| `references/shotlist.md` format and actions | The story structure in `references/shotlist.md` §1 if the partner's brief fixes a different shape or length |

**Before writing any narration on a hiring-partner project**, read `Gauntlet AI/.claude/rules/hiring-partner-framing.md` (*Demo video* section) and follow it over this skill's default story structure wherever they differ:

1. **The brief's own limit and required topics come first** (AEA: 3 to 4 minutes, "design reasoning, not a feature tour"; check the project's `docs/source/` brief).
2. **Product working first, under five minutes, never cut for anything else.** The time left inside the partner's limit goes to the pillars and the business, technical and research decisions behind the build.
3. **Build `docs/delivery/YYYY-MM-DD-demo-decision-inventory.md` first** (dev logs → decision records → research → framing doc and `SUBMISSION.md`), then fit its top rows into the shot list. This replaces the thin optional "under the hood" card in `references/shotlist.md`.
4. **Open on layer 2 (the business value and its metric), prove layer 1 (the brief's problem), close on how the system drives the metric.**
5. Respect the project's brief-conformance rule: nothing on screen or in the narration claims what the brief does not ask for or what is stubbed. Say what is stubbed, as the brief usually requires.

The ElevenLabs key lives in the project's own `.demo/.env`; never in the workspace root `.env` (that file is for dev-tool keys and is read-only to Claude).

## 1. Setup and the ElevenLabs key

Run `demo.py setup`. It installs Python packages and Chromium, checks ffmpeg, creates `.demo/.gitignore`, and reports whether the keys are present.

The key lives in **`.demo/.env`**, which is git-ignored:
```
ELEVENLABS_API_KEY=...
ELEVENLABS_VOICE_ID=...        # optional
```
If the user put the key somewhere else in the repo, move it into `.demo/.env`, and confirm with `git check-ignore -v .demo/.env` that it is ignored. If a key file is tracked by git, stop and tell the user. A committed key should be rotated. Never print the key or paste it into chat, a commit, or the shot list.

If no voice is chosen, run `demo.py voices` and ask which voice to use. If the user wants their own voice, they can record one to three minutes of clean speech, and then you run `demo.py clone --name "<name>" --files sample.mp3`. Put the resulting id in `.demo/.env`.

## 2. Understand what to show

Read the design docs before anything else: PRD, USERS, REQUIREMENTS, KEY_METRICS, ARCHITECTURE, stories, the README, and CLAUDE.md or AGENTS.md. From them, work out:
- the problem and who has it, which becomes the intro;
- the demoable requirements or stories, and the single user workflow that connects them, which becomes the app scenes;
- the primary metric, if one exists, so you can show it on screen;
- how to run the app locally (the dev command and URL) and whether it needs a login.

If the run command or URL is unclear, ask. For a login, have the user run `demo.py login --url <login page>` and log in by hand. That saves `.demo/auth.json`.

If the user gives only a deployed URL and a PRD with no repo, that works too. Skip the evidence fields and the code checks.

## 3. Gather context

```
demo.py context --repo . --url <url> [--dev "<dev command>"] [--auth .demo/auth.json]
```
This writes two files:
- `.demo/build/site_map.json` covers each page the crawler reached: headings, links, buttons, inputs, and visible text. This is the ground truth for selectors.
- `.demo/build/context.md` holds the repo inventory: design docs, per-file UI selectors found in source (test ids, ids, placeholders, aria-labels, button text), frontend and API routes, dependency manifests, and the file tree.

The inventory is a map, not a substitute for reading. Open the actual components and handlers behind each scene you plan, so the narration describes what the code really does.

## 4. Write `.demo/shotlist.yaml`

Read `references/shotlist.md` first. It has the story structure, the text-to-speech narration rules, the file format, every action, selector guidance, and timing advice. Then write the file.

Give every app scene an `evidence:` list of one to three repo files that implement it. This is how the user, and you, check that the video doesn't overclaim.

## 5. Verify claims against the code

Before running anything, reread each scene and confirm three things:
- the feature works the way the narration says, and the `evidence` files exist and implement it;
- numbers in the narration match what the UI will show;
- technical claims are backed by the docs, the manifests, or code you've read.

Fix anything that doesn't hold up. Cutting a claim beats an inaccurate video.

## 6. Dry-run until every action works

Run `demo.py check`, with `--headed` if you need to watch. On failure, it writes `.demo/build/failures.json`, which records each failed action, the error, and `page_at_failure` (the elements actually on the page at that moment). Use that to fix the scene:
- **Wrong selector:** pick one that exists in `page_at_failure` or in the source.
- **Element not there yet:** add a `wait_for` before it.
- **Wrong page:** fix the earlier `goto` or the scene's `before`.

Repeat until `check` passes. If the same scene still fails after about four attempts, show the user the error and ask. Something may be broken in the app itself, which is worth telling them.

## 7. Approval gate

Run `demo.py export`, then show the user a table:

| # | scene | requirement | evidence | est. time |
|---|---|---|---|---|

Add the estimated total and point them to `.demo/build/script.md` to read the full narration. **Stop here and wait** for approval or edits. Apply their edits verbatim to the narration, keeping the rules in `references/shotlist.md` (for example, spelled-out numbers).

## 8. Render

```
demo.py render --subs
```
This voices each scene (cached by text, so re-renders after small edits cost little), records the browser timed to the audio, and writes `.demo/<project>_demo.mp4` and `.srt`. Watch the output for two things:
- **`actions ran Xs past the narration`** means part of a scene will be silent. Lengthen the narration, trim waits, or move navigation into `before`, then re-render.
- **A total over 5:00:** trim the narration and re-render.

If the user would rather speak the narration themselves, they record one file per scene as `recordings/<scene id>.wav`. Then run `demo.py render --own-audio recordings --subs`.

## 9. Review the cut

Run `demo.py frames` and look at every image in `.demo/build/frames/`. You get one frame from the middle of each scene and one from its end. For each scene, check:
- the screen shows what the narration says at that point;
- there are no error pages, stuck spinners, empty states, cookie banners, or dev overlays such as the Next.js error toast or the React Query devtools;
- the PRD badge and captions don't cover the important UI;
- the cards are readable.

Fix the problems you find, re-render, and look again. Only changed scenes regenerate audio.

## 10. Deliver

Give the user:
- the video path;
- its duration;
- a one-line summary per scene;
- anything you cut or couldn't show, and why.

Mention that `.demo/shotlist.yaml` is worth committing, so the video can be regenerated after the app changes.

## Two sessions, overlays and caption band (added 2026-10-22, Riverside)

A demo that crosses roles (a family app and a staff console) uses `pages:` and a per-scene `page:`; only the session on camera is screencast, and the cut between them is a normal scene boundary. Editorial captions that belong to the video, not the app (a proposed metric, an evidence line), use the `overlay` action. When the app's primary controls sit at the bottom of the screen, set `caption_band` so burned-in captions sit in a strip below the app. Details and syntax: `references/shotlist.md` §3–4.

## Troubleshooting

| symptom | fix |
|---|---|
| `could not load any page` | The app isn't running. Pass `--dev`, or ask the user how to start it. |
| A login page appears in the recording | Use `demo.py login`, then set `auth: {storage_state: .demo/auth.json}`. |
| ElevenLabs 401 | Wrong key in `.demo/.env`. |
| ElevenLabs 404 | Wrong voice id. Run `demo.py voices`. |
| Voice sounds flat or rushed | Raise `style` to 0.3, or set `speed: 0.95` in `voice:`. |
| Text is soft in the video | Use a 1280×720 `viewport`. Larger UI text survives encoding better. |
| ffmpeg `subtitles` filter error | Drop `--subs`. The `.srt` is still written next to the video. |
| A highlight pushes the app's header off screen (chat thread scrolls inside a fixed card) | Set `page_scroll: minimal` in the shot list (added 2026-10-22, AEA). |
