# Writing `.demo/shotlist.yaml`

The shot list is the video's source. Each scene is narration plus the browser actions that play while it is spoken. A scene lasts as long as its narration audio plus a short tail. The script measures the audio and holds the picture to match.

## Contents
1. Story structure
2. Narration rules (it is read by text-to-speech)
3. File format
4. Actions
5. Selectors
6. Timing
7. Example

## 1. Story structure

The audience is a hiring partner deciding in a few minutes whether the builder can ship. Aim for 3 to 4 minutes, which is about 450 to 600 words of narration at 150 words per minute. Never go over 5 minutes.

1. **Intro card, about 20 seconds.** Cover the problem, who has it, and what the product does about it. Write it in first person ("I built…").
2. **Four to seven app scenes.** Walk the core user flow end to end, in the order a real user would do it. Each scene proves one requirement and names it in `requirement`. If the repo has stories or numbered functional requirements, make one scene per demoable story, reuse their IDs, and order the scenes as the user's workflow. If a primary metric is defined (KEY_METRICS or similar) and the app can show it, put it on screen.
3. **Optional under-the-hood card, about 25 seconds.** Cover the two or three most interesting technical decisions. Every claim must be backed by the docs, the dependency manifests, or code you have read. Never guess at the stack.
4. **Outro card, about 10 seconds.** Give a one-line recap and where to try it.

Each app scene's narration runs 40 to 100 words. Show, don't list. Narrate what the viewer is seeing as it happens and why it matters to the user.

## 2. Narration rules

ElevenLabs reads the text exactly as written:
- Spell out numbers and units ("forty percent", "under two seconds", "twenty twenty-six").
- Expand symbols: "&" becomes "and", "/" becomes "or" or "per", "%" becomes "percent", "→" becomes "to". Don't use markdown, emoji, parentheses, or bullet characters.
- Say domains naturally ("taskpilot dot app"). Never read out URL paths.
- Write acronyms the way they should be spoken: "an A P I" if letters, "SQL" only if "sequel" is fine.
- Keep sentences short. Commas and periods control pacing; an em dash gives a brief pause.
- Be confident and specific, not salesy. Cut filler like "as you can see", "simply", and "seamlessly".
- Every claim must be true of the app as recorded. If the UI says 1.8 seconds, don't say "instantly".

## 3. File format

```yaml
project: "Product name"          # shown on cards; the output file is named from it
tagline: "One line"
url: http://localhost:3000/      # base for relative goto paths
dev:                             # optional: started if url is down, stopped afterward
  command: "npm run dev"
  url: http://localhost:3000/
  ready_timeout: 120
viewport: {width: 1920, height: 1080}
show_requirement: true           # "PRD ✓ <requirement>" badge in app scenes
page_scroll: minimal             # optional: after scrolling to a target, snap the page back to the top when the target
                                 #   stays visible (apps whose chat thread scrolls inside a fixed card)
voice:
  voice_id: "..."                # or leave out to use ELEVENLABS_VOICE_ID from .demo/.env
  model: eleven_multilingual_v2
  stability: 0.5
  similarity_boost: 0.8
  style: 0.15
  # speed: 1.0                   # 0.7 to 1.2
auth: {storage_state: .demo/auth.json}   # optional, from `demo.py login`
pages:                           # optional: more browser sessions, e.g. a staff console beside the family app
  staff: {auth: {storage_state: .demo/staff.json}}   # auth optional; a scene uses one with `page: staff`
caption_band:                    # optional: captions go in a strip below the app instead of over it
  height: 80                     # the final video is viewport height + this; pick the viewport so the sum is 16:9
  background: "#14152b"
  label: "Synthetic demo"        # optional pill at the band's left, shown for the whole video
card_theme: {background: "...", accent: "#7ee2a8"}   # optional
scenes:
  - id: intro                    # unique snake_case; audio files are named from it
    type: card
    title: "Big headline"           # or html_file: .demo/cards/arch.html for a hand-made card (hide #__demo_cursor in it)
    subtitle: "Optional line"
    lines: ["Optional", "short phrases"]
    narration: "..."

  - id: search_flow
    requirement: "R2: Users can search transcripts by keyword"
    evidence: ["src/app/search/page.tsx", "src/lib/search.ts"]   # where it's implemented
    before:                      # runs off camera before the scene starts
      - goto: /search
    narration: "..."
    page: main                   # optional: which session from `pages:` this scene is on (default main)
    actions:                     # run on camera while narration plays
      - type: {selector: '[placeholder="Search"]', text: "pekora collab"}
      - press: Enter
      - wait_for: '[data-testid="result-card"]'
      - highlight: '[data-testid="result-card"] >> nth=0'
```

## 4. Actions

| action | form | notes |
|---|---|---|
| goto | `goto: /path` or full URL | waits for DOM, then briefly for network idle |
| click | `click: SELECTOR` | the cursor glides to the element, then clicks with a ripple |
| double_click | `double_click: SELECTOR` | two real clicks ~90 ms apart, both rippled; for showing a double tap is handled |
| hover | `hover: SELECTOR` | |
| type | `type: {selector: S, text: "…", delay_ms: 45}` | clears the field first, types like a human |
| press | `press: Enter` | any Playwright key name |
| select | `select: {selector: S, value: "v"}` | for native `<select>` |
| scroll | `scroll: {y: 600}` or `scroll: SELECTOR` | smooth |
| highlight | `highlight: SELECTOR` or `highlight: {selector: S, seconds: 4}` | outline held 2.5 s (or `seconds`); the next action waits for it. Give each highlight its own short scene so it lands on its sentence |
| wait | `wait: 1.5` | seconds |
| wait_for | `wait_for: SELECTOR` | up to 60 s; use for anything async (AI output, fetches) |
| at | `at: 6.0` | wait until 6 s into this scene's narration, to land an action on a sentence |
| wait_gone | `wait_gone: SELECTOR` | up to 60 s until it is hidden or removed (a typing indicator, a spinner) |
| upload | `upload: {selector: 'input[type=file]', file: demo/card.png, click: 'text="Choose a photo"'}` | the cursor taps the visible picker button (`click`, optional), then the file is set on the input; no native dialog opens |
| overlay | `overlay: {id: metric, html: "<span class=k>North Star</span>…", pos: top-right}` · `overlay: {id: metric, remove: true}` · `overlay: clear` | an editorial box drawn by the video over the page (a title, a metric, an evidence line). It persists across scenes and navigation until removed. `pos`: top-left, top-right, top-center, bottom-left, bottom-right, bottom-center, center, or raw CSS. Inside `html`, `.k` is a small kicker line, `.big` a large title, `<b>` an accent |
| any | `{{run}}` inside any action text | replaced by a per-run token (MMDDhhmmss), e.g. `priya+{{run}}@example.com` for a fresh sign-up in every take |
| eval | `eval: "fetch('/api/...')"` | off-camera setup only, in `before`: runs page JavaScript and waits for a returned promise |

## 5. Selectors

These are Playwright selectors. In order of preference:
1. `[data-testid="x"]`
2. `#id`
3. `[placeholder="…"]` or `[aria-label="…"]`
4. `text="Exact visible text"`
5. `role=button[name="Label"]`

Use `>> nth=0` to pick the first of many. Take selectors from `site_map.json` (what the live page actually has) first. Use the source code for elements that appear only after interaction, such as results, modals, and toasts. Avoid generated CSS class names like `.css-1x2y3z` or `.sc-abc`, because they change between builds.

Use realistic, specific input text that makes the product look good. Never use "test" or lorem ipsum.

## 6. Timing

- An action sequence that takes longer than its narration makes the overrun silent. `record` warns with the overrun in seconds. Fix it by adding narration, trimming waits, or moving navigation into `before`.
- For slow steps like AI responses, put the slow action early in the scene and talk over the wait. Then use `wait_for` before referring to the result.
- Use `at:` sparingly, to land a click right as the narration names it.
- Space actions so a viewer can follow, with one main action every few seconds.

## 7. Example app scene

```yaml
  - id: live_captions
    requirement: "FR-1: Captions appear within two seconds of speech"
    evidence: ["src/pipeline/asr.py", "web/components/CaptionOverlay.tsx"]
    before:
      - goto: /watch/demo-stream
    narration: >-
      Here's a live stream in Japanese. As the streamer talks, English captions
      land under the video, usually in about a second and a half. That number in
      the corner is the measured delay for each line, so viewers can trust they
      aren't missing the joke.
    actions:
      - click: '[data-testid="play"]'
      - wait_for: '[data-testid="caption-line"]'
      - at: 7
      - highlight: '[data-testid="latency-badge"]'
      - wait: 2
```
