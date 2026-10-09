# Source-verified visuals: manual authoring runbook

Use this workflow when a small visual helps a reader understand a paper, a reported comparison, or an explicitly sourced sequence. Existing prose, headings, dates, source links, author fields, and category conventions remain the baseline. This runbook does not authorize historical article rewrites, publication, or schedule changes.

The exact supported fields and constraints are in [visual-schema.md](visual-schema.md). The shared `assets/content-visuals.js` module exposes `validate(object) -> { ok, errors }` and `renderJSON(raw) -> HTML`; both apps use the same declarative schema. A valid object is structurally valid, not independently fact-checked.

## 1. Find the question and the primary evidence

1. Decide what the reader needs to see: study design, reported event frequencies, an effect with its confidence interval, or a like-for-like numerical comparison. Use prose alone if a figure does not make that question easier.
2. Open the primary paper, official report, or original dataset. Check publication/version, corrections, study population, the exact outcome, units, denominator or analysis population, time point or follow-up, and uncertainty. Do not treat an existing summary, search snippet, or local index as evidence for new facts.
3. Record the source's exact URL, a meaningful source label, the actual date you verified it in `asOf`, and a locator such as its table, figure, abstract result, or section. The verification date is not the publication date, data cutoff, measurement date, or briefing date. Preserve those distinct dates in prose; never substitute today's date for an unknown source date or claim verification that did not happen.
4. Copy only source-verified values. Do not infer a missing number from a sentence, estimate a value from a chart image, calculate an unreported result, or convert a missing value to zero. If a required value cannot be verified, omit that chart and explain the limitation in prose. A separately verified, nonquantitative study-design visual can still be useful.

One verified source URL available to the project is `https://www.nejm.org/doi/full/10.1056/NEJMoa2600526`. The URL alone does not establish any study fact or numerical value; reopen the primary source before authoring content from it. Do not populate a visual merely to match a fixture.

## 2. Use recent-coverage pointers within the required archive checks

Compare the candidate's DOI/URL identity and concise topic against the small local evidence index described below to locate likely prior coverage. This partial helper does not authorize selectively skipping older documents. Only independently complete, source-hash-verified coverage of the required window can support selective rereads under the active runbook; otherwise complete its full/raw fallback. A match does not validate the facts, establish evidence quality, or justify repeating a story.

- Prefer the same stable topic wording for the same question. DOI identities are normalized to lowercase; URL identities preserve query parameters and discard page fragments. Source URLs and locators remain in the records.
- Reopen the primary source whenever a fact is new, corrected, or materially changed. Check the correction/version and explicitly describe the change in accompanying prose.
- A missing match does not establish novelty. This helper is a partial search aid for explicitly supplied documents, capped at 200 records. It is not a complete 90-day coverage index. Its coverage flag always says `archiveComplete: false`.
- Preserve every archive-screening requirement in the active editorial runbook, including Study's full 90-day duplicate screening and full relevant, ambiguous, and recent same-Day example reads. Only an independently complete, source-hash-verified coverage index can justify skipping nonmatching old bodies. Missing, stale, truncated, or ambiguous coverage requires the runbook's full/raw fallback; report incomplete coverage honestly. This manual helper alone cannot justify that skip.

## 3. Choose one supported representation

| Type | Suitable question | Required evidence discipline |
| --- | --- | --- |
| `research-design` | Who was studied, how groups were formed, and what was measured? | Preserve design, population, reported group details, and follow-up. Do not invent randomization, causality, or a clinical decision pathway. |
| `event-bars` | How frequent was the same reported patient event in comparable groups? | Use verified observed percentages, event counts, and analysis-population denominators with the same outcome and time window. This template does not support adjusted rates, person-time incidence, or nonhuman counts. |
| `effect-ci` | What is the reported effect estimate and its uncertainty? | Use the source's estimate, interval, measure, units, population, comparator, and time point. Do not invent an interval or interpret association as causation. |
| `comparison-bars` | How do directly comparable reported numerical values differ? | Use a common explicit unit and period, and preserve source-reported signs. A shared unit alone does not make different populations or time periods comparable. |

Consult the schema for the precise type-specific fields rather than inventing extra fields. Do not mix incompatible measures or intervals in one chart. If different follow-up periods or denominators make a comparison misleading, explain them in prose or a clearly labeled table instead.

## 4. Add the figure with its prose

- Insert an exact `visual` fenced JSON block inside the relevant existing `####` content section. All common fields are required: `version: 1`, `type`, `title`, `description`, `topic`, and `source` with `label`, `url`, `asOf`, `locator`. Use the documented type-specific fields and strict JSON; unknown fields are rejected.
- Keep the explanatory abstract/results and limitations alongside the figure. A visual supplements the written explanation; it never replaces the source, caveats, or clinical context. Make the main takeaway readable without seeing the chart.
- Make titles and descriptions concrete, with the population, metric, unit, and observation period visible where relevant. Say what uncertainty means and what the study cannot establish. Color is not a rating of evidence strength.
- Prefer one or two helpful visuals for a main article when evidence is sufficient. Use at most three with distinct explanatory purposes per article, and twelve per issue as editorial limits. These are ceilings, not quotas; do not fill every slot. Each block must fit within 12,000 UTF-8 bytes, including Korean text. Keep documents small and readable on mobile.
- Do not add executable JavaScript, arbitrary HTML, remote chart services, or daily generated rendering code. Rendering is deterministic and handled by the shared renderer. Do not use image generation to depict study results. Link to a source figure if necessary; do not copy a protected figure without permission.

If validation or source verification fails, leave the existing prose intact and omit or correct the visual. Do not change a value to make validation pass.

## 5. Validate and review before any authorized release

1. Validate against the actual shared module and review every error. The local index command also validates every supplied `visual` block with that module before changing the index.
2. Review the rendered figure beside the source. Confirm labels, signs, denominators, values, units, intervals, time point, source link, and locator. Check mobile layout and keyboard/accessibility text. Confirm that no prose disappeared.
3. Check the published engine and helper syntax in either repository:

   ```sh
   node --check assets/content-visuals.js
   node --check scripts/update-evidence-index.cjs
   ```

4. For a visual's JSON copied to an explicitly chosen local review file, run the shared validator directly (replace the placeholder path):

   ```sh
   node -e "const fs=require('node:fs');const v=require('./assets/content-visuals.js');const r=v.validate(JSON.parse(fs.readFileSync(process.argv[1],'utf8')));console.log(r);process.exitCode=r.ok?0:1" /absolute/private/review-visual.json
   ```

   To validate all visual blocks in a Markdown document, use the manual index-update command in section 6 with an explicitly chosen private index path. `--check` checks byte freshness only; it does not revalidate changed visual content. Maintainers should also run their full regression suite before release. Syntax and structural checks do not replace primary-source verification, the 12,000-byte block limit, or rendered/mobile/accessibility review.
5. Keep publication and schedule changes separate and subject to their existing authorization. This manual helper is not wired into generators, scheduled tasks, application startup, or deployment. Scheduled runs must not write or update this index; the existing daily-only output boundary remains unchanged.

## 6. Update the bounded local index explicitly

Choose an existing private local directory outside published site assets. The index is a lightweight authoring aid; it is not a browser asset or a source-of-truth database. Supply the exact destination and the new or corrected Markdown files:

```sh
node scripts/update-evidence-index.cjs /absolute/private/evidence-index.json path/to/new-briefing.md
node scripts/update-evidence-index.cjs /absolute/private/evidence-index.json path/to/first.md path/to/second.md
node scripts/update-evidence-index.cjs --check /absolute/private/evidence-index.json path/to/first.md path/to/second.md
node scripts/update-evidence-index.cjs --help
```

The examples are placeholders, not commands to run unchanged. The destination must end in `.json`; each input must be an explicit local `.md` file. The parent directory must already exist for writes. The helper does not discover files, contact websites, or make directories. It reads only the requested index, the explicitly supplied Markdown, and the shared validator. Supply historical files explicitly for a one-time manual backfill; that is separate from scheduled generation.

`--check` is read-only and returns a JSON freshness report for the explicitly supplied paths: `current`, `current-partial`, `changed`, `unindexed`, or `missing`. It does not follow paths from the stored index. Exit code 0 means all requested files are current with their records retained; 2 means at least one needs attention; 1 means malformed input or another failure. Even exit code 0 does not establish full archive coverage or factual correctness.

### What is stored and how it is bounded

- Top-level fields: `version`, `referenceDate`, `coverage`, `documents`, `records`.
- Each record stores `kind`, `identity`, `topic`, `title`, `asOf`, `type`, `source` (`label`, `url`, `locator`), and `document` (`path`, `date`). Paths are relative to the index's directory. No chart values or assertion of factual verification are stored.
- `kind: "visual"` comes from schema-validated metadata. For historical prose without visual blocks, links under `###` article headings produce `kind: "historical"` pointers. Their title and topic come from the heading, their source label explicitly says unverified, and `asOf` and `type` are `null`. These are search hints, not source-proven metadata. Links inside fenced examples are ignored. A visual's source identity takes precedence over historical pointers for that same identity in the supplied document.
- Each `documents` entry stores its relative `path`, heading `date`, raw-byte SHA-256 `sourceHash`, Git blob SHA-1 `gitBlobSha`, and `recordsComplete`. Git blob SHA-1 uses Git's `blob <byte length>\0<bytes>` format so a trusted repository tree can identify unchanged source blobs without fetching their bodies. Never compare a plain file SHA-1 to a Git blob SHA.
- Local freshness checks still read the explicitly requested files to hash their bytes. An unchanged document with all its extracted pointers retained can reuse its stored metadata without reparsing. A changed or incomplete one is parsed again when manually updated. Remote tree/blob checks require a trusted listing for the exact repository/revision; this helper makes no remote requests and does not implement that separate coverage check.
- `recordsComplete` means the document's extracted pointers survived deduplication and the record cap, not that its whole clinical meaning or every topic was captured. `coverage.scope` is `explicit-inputs-only`, and `coverage.archiveComplete` is always false. `omittedRecords` and `omittedDocuments` report candidates omitted in this update; earlier omissions are not recovered automatically. Neither this manifest nor a matching hash proves the whole required archive was supplied.
- Each document's date is the valid `YYYY-MM-DD` at the beginning of its first level-one heading, outside fenced code. A filename, filesystem timestamp, or today's date is not a substitute.
- `referenceDate` is the latest document date supplied so far, including the existing index reference date. Retention includes that day and the preceding 89 calendar days. A later prose-only document can advance the window. Backfills do not move the reference date backward.
- At most 200 newest records remain, deduplicated by normalized source identity plus case-insensitive, NFC-normalized topic. A newer document wins; deterministic metadata tie-breaks resolve equal dates. Several figures about the same source/topic yield one lookup record, not a complete visual inventory.
- Re-supplying a document removes its old index records before collecting its current visuals. This prevents a removed figure or corrected source/topic from leaving a stale entry. Unsupplied historical documents are never reopened.
- At most 200 document-manifest entries remain within the same 90-day window. Up to 100 explicit input paths are accepted per invocation. Each source or existing index is limited to 2 MiB; each visual is limited to 12,000 bytes. These input bounds keep manual updates small.
- All inputs and any existing index are validated before writing. Malformed JSON, unsupported schema, impossible dates, invalid records, unsafe keys, or an unclosed visual fence abort the entire update and leave the previous index unchanged.
- Writes use a private temporary sibling file and an atomic rename at the requested destination; the temporary file is cleaned up on failure. A symbolic-link index target is refused. Markdown sources and unrelated files are not modified. Run one update at a time; concurrent authoring updates are not a database transaction.
- Identical inputs produce identical index bytes. An unchanged result is left untouched. Do not commit or publish a private working index inadvertently.

To locate likely coverage, inspect `records` for the source identity or topic and use matching `document.path` values as pointers. This does not replace required full-archive screening or relevant/ambiguous reads. Always return to the primary source for evidence. An index entry is only a pointer to earlier authoring work.
