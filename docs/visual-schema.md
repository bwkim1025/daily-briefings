# Content visual blocks · version 1

Both applications use the exact same dependency-free `assets/content-visuals.js` and CSS. A fenced block whose language is exactly `visual` contains one JSON object. Everything else is ordinary Markdown. These figures accompany the explanation; they do not replace it. See [the authoring guide](VISUAL-AUTHORING.md) for source verification and selection.

The renderer calls no model or external service. It uses fixed HTML/SVG templates with escaped text; arbitrary HTML, SVG, image URLs, JavaScript, chart code, callbacks and styling fields are unsupported. Unknown types/fields, malformed JSON, inconsistent values and unsupported versions fall back to escaped source data. An unclosed fence is never rendered as a figure. A missing renderer also falls back safely.

## Common fields (all required)

- `version`: integer `1`.
- `type`: `research-design`, `event-bars`, `comparison-bars`, or `effect-ci`.
- `title`: nonempty text, at most 160 characters.
- `description`: source-grounded explanation and caveat, at most 600 characters. Explain what the reader should notice without inventing a conclusion.
- `topic`: compact search hint, at most 100 characters. It is not evidence.
- `source`: exactly `{label, url, asOf, locator}`. Label ≤160 characters; HTTP(S) URL ≤2,000 with no credentials/whitespace/control characters; `asOf` is the real verification date in `YYYY-MM-DD`; locator ≤240 characters identifies the source section/table/abstract. A URL/date is attribution, not proof the data have been verified.

Blocks are capped at 12,000 UTF-8 bytes. Unknown keys are rejected at every object level. Numbers must be JSON numbers, finite and bounded to an absolute value of 1,000,000,000. Missing values are never guessed or converted to zero. Text values are plain text, not nested Markdown. Preserve the source's reported precision.

## Research design

Additional fields:

- `population`: `{label, detail, n?}`.
- `allocation`: source's design/allocation wording, ≤180 characters. Do not label observational groups randomized.
- `arms`: 2–4 `{label, detail, n?}` objects.
- `followUp`: explicit duration/process, ≤180 characters.
- `outcome`: source's measured endpoint, ≤240 characters.

Node labels ≤100 characters; details ≤240. Optional `n` is a positive integer. Omit it if unreported; never infer counts. When population and all group counts are supplied, group counts must sum to the supplied population count. This is a population-to-group design diagram, not a clinical decision algorithm, CONSORT diagram, or free-form causal graph. Do not omit exclusions/crossover if doing so would misrepresent the source; choose prose/table instead.

## Observed event bars

Additional fields:

- `measure` (≤180 characters), `timeframe` (≤160), `unit` exactly `%`.
- `rows`: 2–6 `{label, value, events, denominator}` objects.

Labels ≤100. `value` is the **reported observed percentage**, 0–100. Events are a nonnegative integer; denominator is a positive integer; events cannot exceed denominator. Values must be consistent with the event counts within the reported percentage's rounding precision. The renderer displays the reported value, not a recomputed estimate. The axis is always 0–100%. Denominators are outcome-analysis people, which can differ from randomized group counts. This patient-event template does not support adjusted rates, person-time incidence or nonhuman counts; use another representation instead.

## Generic numeric comparisons

Additional fields:

- `measure` (≤180 characters), `timeframe` (≤160), `unit` (≤40).
- `rows`: 2–6 `{label, value}` objects, labels ≤100 characters.

Use source-backed measurements with the same definition, units and time basis. Values may be positive, negative, or zero. The shared linear axis always includes zero, with the baseline shown; it is not a percent-truncated chart. An all-zero dataset uses a 0–1 display axis and draws no positive bars. Axis bounds are layout choices, never invented observations. Clinical patient-event comparisons belong in `event-bars` so counts/denominators remain explicit. Do not compare prices/currencies/time windows with mismatched definitions. No automatic conversion or normalization is performed.

## Effect estimate and confidence interval

Additional fields:

- `metric`: `difference` or `ratio`.
- `measure` (≤180), `comparison` (≤180; explicitly name group order), `basis`: `adjusted` or `unadjusted`.
- `unit`: explicit absolute units for differences (e.g. `%p`, `mmHg`); exactly `ratio` for ratios. `%` is rejected for differences: percentage-point differences must be labeled `%p`.
- `estimate`: reported point estimate.
- `interval`: exactly `{low, high, level}` with the reported confidence interval and confidence level (e.g. `95`). `low ≤ estimate ≤ high`; confidence level >0 and <100.
- Optional `pValue`: the exact numeric reported P value, 0–1. If only an inequality is reported, preserve it in prose and omit this field; do not invent a numeric bound as the exact value.
- Optional `lowerLabel`, `upperLabel`: ≤120 characters each; supply both or neither. Use source-supported direction labels; smaller numbers are not automatically beneficial.

Difference plots use a linear scale and null **0**. Ratio plots use a logarithmic scale and null **1**; estimate and both interval endpoints must be strictly positive. The null is always in the display domain, with a labeled explanatory note. Negative differences are valid. Never substitute event-rate subtraction for a reported adjusted difference, relative risk, odds ratio or hazard ratio. Do not mix risk, odds and hazard labels. This type specifically requires a reported CI; when there is none, retain the estimate in prose/table or an appropriate comparison without a fabricated interval.

The renderer reminds readers that an interval containing the null does not establish equivalence. Its checks establish structural consistency, not statistical validity, clinical applicability, causation, or source authenticity.

## Verified SODa-BIC example

The source-verified example is installed additively in Study's 2026-10-06 briefing. Allocation counts are 245/255. MAKE30 outcome denominators are 244/254, with 98/100 events and reported 40.2%/39.4%. The separately reported adjusted difference is +1.2 percentage points (95% CI −7.1 to +9.4, P=0.78). These are distinct quantities.

[Primary paper: NEJM DOI 10.1056/NEJMoa2600526](https://www.nejm.org/doi/full/10.1056/NEJMoa2600526). Source extraction was verified 2026-10-09; adding the visual does not update the original article's publication date or author.

## Local development contract

CommonJS: `require('./assets/content-visuals.js')`; browser: `window.ContentVisuals`. Public API: `validate(object)` returns `{ok, errors}`; `renderJSON(string)` returns safe figure/fallback HTML; `fallback(string)` returns escaped text; `MAX_BYTES` and `TYPES` are exported. No dependency installation is required. The Markdown integrations own fence closure and missing-engine fallback. Changing the schema requires matching changes/tests in both copies. Asset query versions and each application's scoped service-worker version must be updated together for a reviewed release.
