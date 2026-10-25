# Capture Notes — how the sources were captured, and how to repeat it

**Rank:** DERIVED. **Captured:** 2026-10-24 (all times UTC). **By:** a Claude Code session on
Innocent's Mac. Everything captured from Newsela's sites lands in the git-ignored
`docs/source/restricted/` (see `source-register.md`, *Handling rule*).

## Summary: what worked and what did not

| Target | Tried | Result |
|---|---|---|
| Google Sheet, CSV | `curl -L …/export?format=csv` | Worked, no sign-in. **First tab only.** Header row and A1 title preserved; multi-line cells quoted. |
| Google Sheet, XLSX | `curl -L …/export?format=xlsx` | Worked. **The only export that shows the hidden tab** and keeps the `=SUM` formula. |
| Google Sheet, tab list | `curl -L …/htmlview` | Worked, but lists **visible tabs only** (`Lesson Outline`, gid `1723306320`). The hidden tab's name came from `xl/workbook.xml` inside the xlsx. |
| Google Sheet, one tab | `…/gviz/tq?tqx=out:csv&sheet=Lesson%20Outline` | Worked, but gviz **folds the first data rows into the header** (A1 + row 2 + row 3 joined into one header line). Use the xlsx for structure. |
| Hidden tab via gviz | `…&sheet=CG%20Working%20Tab%206.3%20DELD%20Scope%20%26` | **Failed silently:** returned the first tab byte for byte (the stored name is truncated). Read it from the xlsx with openpyxl instead. |
| Review site, lesson page | `curl` of the lesson URL | **Worked, no sign-in, no bot wall.** The page is server-rendered Next.js (~247 KB). The visible text is present, and the **whole lesson record is in the RSC payload** as JSON. No browser needed. |
| Review site, structure | `curl` of `/`, `/course/<id>`, `/course/<id>/unit/<id>` | Worked; same RSC technique gives course list, outlines and unit pages. |
| Review site, screenshot | chrome-devtools MCP, new page in an **isolated context** (`isolatedContext: "newsela-capture"`), background tab | Worked. Sections are collapsed in the browser (an accordion); clicking **Expand all** by script (`button` with text "Expand all", `.click()`) worked and raised visible text from 2.7k to 10.5k characters. Full-page expanded screenshot exceeds Chrome's 16,384 px limit, so its bottom may repeat. Page closed afterwards; no other tab touched, no storage cleared. |
| Program PDFs | `curl https://media.newsela.com/core/pdfs/<id>.pdf` | Worked, public. Ids come from the course page's `resource_sections`. |
| CDE standards PDFs | `curl -A "Mozilla/5.0"` | Worked for the three URLs in `source-register.md` C-1…C-3. Guessed URLs `finelastandards.pdf` and `schoollibrarystnds.pdf` returned HTTP 404 with a ~35 KB HTML error page saved under the `.pdf` name, so check `file` output as well as the status. |
| WebFetch | not used | `curl` returned the full server-rendered page, so the JS-shell problem never arose. |
| Login wall | none met | The review site shows a generic signed-in avatar ("CU") with no account; nothing was bypassed. |

## Review-site URL patterns

Base: `https://ca-2026-review.newsela.com`

| Page | Pattern | Example id |
|---|---|---|
| Home (course list, tabs "ELA Courses" / "ELD Courses") | `/` | — |
| Course, teacher view | `/course/<courseId>` | G6 ELA `cmkfw4elj004k8a90yvyfyfb8` |
| Course, student view | `/student/course/<courseId>` | |
| Unit | `/course/<courseId>/unit/<unitId>` | G6 U4 `c0rwxfse5262agf59dprt4ll` |
| Lesson, teacher edition | `/course/<courseId>/unit/<unitId>/lesson/<lessonId>` | G6 U1 L1 `c0c4tx7u3mnezs5w9u8vzvi1` |
| Lesson, student edition | `/student/lesson/<lessonId>` | |
| Lesson text reader | `/course/<c>/unit/<u>/lesson/<l>/view/<textCardId>` (teacher) · `/student/lesson/<l>/view/<textCardId>` | |
| Images | `https://images.newsela.com/core/images/<id>.jpg?…` | |
| PDFs (resources, assessments) | `https://media.newsela.com/core/pdfs/<id>.pdf` | |

Ids are cuids (25 chars, start with `c`). Course ids: ELA Core 6/7/8 `cmkfw4elj004k8a90yvyfyfb8`,
`cmkfw4erh009k8a90bbxovwi4`, `cmkfw4exh00e38a90zyr4xg1o`; ELD Core 6/7/8 `cmlligl0l0000be90faaxbgk3`,
`cmllkqjlz0000e8901ex1uu4r`, `cmlliglwf0000cn90o61tg23a`. Unit and lesson ids are in
`restricted/originals/site-structure/` and `restricted/03-example-lessons/README.md`.

## The extraction technique (repeat it in a minute)

1. `GET` the page with a normal browser User-Agent.
2. Collect every `<script>self.__next_f.push([1,"…"])</script>` chunk; JSON-decode each array and
   concatenate the string at index 1. This is the React Server Components stream.
3. Split the stream into records at `\n<hex id>:`. Records whose JSON contains `"queries"` hold the
   **react-query dehydrated state**: `record[3].state.queries[*]` with `queryKey` and `state.data`.
4. Query keys seen: `['course','row']` (home), `['course','page',{id}]`, `['course','outline',{id}]`,
   `['unit','page',{id}]`, `['lesson','page',{id}]`.
5. The lesson object's rich-text fields are ProseMirror JSON (see `04` §1).

The scripts used live outside the repo (in `/tmp`, not kept). A future ticket that needs repeatable
captures should re-create them as a small tool inside the project; the steps above are enough.
Each fetch was spaced 1.5–2 s apart; 50 lesson pages, 7 course/unit pages, 3 PDFs in total.

## What was captured (paths under `docs/source/restricted/`)

| Item | Count | Path |
|---|---|---|
| Lesson records (JSON, with URL and capture time) | 50 | `originals/lessons-json/<course>-u<unit>-l<nn>.json` |
| Rendered lessons (Markdown, full text) | 7 | `03-example-lessons/0n-*.md`, index and lesson lists in `03-example-lessons/README.md` |
| Screenshots of the linked lesson | 2 | `originals/g6-u1-l01-screenshot-collapsed.png`, `…-expanded.png` |
| Course, outline and unit records | 9 | `originals/site-structure/` |
| Program PDFs | 3 | `originals/program-resources/` |
| Sheet exports | 6 | `originals/sheet-export.{xlsx,csv}`, `sheet-htmlview.html`, `tab-lesson-outline.gviz.csv`, `tab-lesson-outline.cell-dump.txt`, `tab-hidden-cg-working-tab-6.3-deld-scope.from-xlsx.csv` |

## Rendering conventions in the restricted Markdown

`▣` marks a `routine_heading` (icon in backticks); `[callout: PURPOSE | SAY / ASK | WATCH FOR …]`
and `[collapsible: …]` are blockquotes; a one-column table renders as `[boxed table, 1 column]`;
`⟦sample response: …⟧` is purple (#720780) text; teal teacher talk is plain text after its label.

## Things to know next time

- The linked lesson is a Spark lesson and is atypical; sample Reading/Writing lessons for structure.
- The browser view hides most content until "Expand all"; the JSON never does.
- The sheet's hidden tab is reachable only through the xlsx export.
- The site's ELD course tab is client-side only, but the course ids are in the home page's
  `['course','row']` query.
