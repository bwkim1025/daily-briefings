# ChatGPT Daily Briefings Automation v1

Updated: 2026-09-18. Target: bwkim1025/daily-briefings, branch main.
This is the GPT-owned runbook. Preserve existing app files, editorial principles, historical articles and metadata.
Run as a ChatGPT web scheduled task with the connected GitHub app, not a local PC automation.
Schedule: daily 07:04 Asia/Seoul, preserving the previous task's stated time. Content may finish after the start time.

## Authentication and safety

Use only the existing authenticated GitHub connector for writes. No plaintext PAT, legacy token helper, copied local credentials or browser-secret extraction.
This runbook's setup commit and read-back verify the current connector write route, not future task permissions.
At runtime, check repository and write-tool availability. Public read access or a permissions flag alone does not prove a successful write.
Do not create/delete probe files on each run. Actual briefing commits are the write evidence.
Honor app approval requirements and report exact missing permissions; never bypass a denial or silently weaken approval settings.
On a failure, preserve completed work, report committed/pending files and the failing action. Do not disable or delete the schedule yourself.
Public repositories must not receive credentials, family financial records, actual patient information or unrelated private conversations.

## KST date and safe retries

Compute TODAY and YESTERDAY in Asia/Seoul, not the runner's UTC date.
07:04 KST is 22:04 UTC on the preceding UTC calendar day.
Only a complete valid TODAY file counts as already published. Yesterday's article is not today's article.
For each category independently: check today's file; preserve a complete one and generate only missing categories.
For incomplete today files, preserve valid material and repair with the current blob SHA. Re-read and reconcile conflicts; do not blind-overwrite.
Research, validate, commit and read back ONE category at a time so interruption does not lose all four.
Order: financial, international, medical, health. Update medical DOI metadata immediately after the verified medical commit, before continuing health.
On retry after a metadata failure, reconcile DOI metadata from today's already-published medical article; do not regenerate that article.

## Sources and editorial policy

Read EDITORIAL-PRINCIPLES.md from main every run, then yesterday's and latest available article for each category.
This document's editorial examples are not factual evidence. Verify new claims against actual dated sources.
Financial/international: prioritize events in the last 24 hours; per category aim for 3 headlines, at least 2 genuinely new.
A repeated story requires a specifically identified new development. State event dates, market session dates and timezone.
US price data are the latest completed regular session as of the run, not automatically the preceding calendar date on weekends/holidays.
Medical/health: publications or updates this week; do not mislabel old papers as this week's.
No fabricated numbers, quotes, approvals, studies, DOIs or source URLs. Open supporting sources; use primary medical/official sources.
If evidence is insufficient, explicitly report the gap instead of inventing content or claiming new developments do not exist.
Facts and interpretation must be distinguishable. Do not make trades or patient-specific treatment decisions.
Paraphrase source abstracts in Korean; do not copy full copyrighted abstracts.

## Exact output schema

Each file begins # YYYY-MM-DD and ends ## AUTHOR.
AUTHOR is actual readable model name · verified model ID or (미확인) · YYYY-MM-DD HH:MM KST; never reuse a Claude sample by default.
App parsers use exact uppercase h2 tags and #### content blocks. Keep these tags and order.

1. financial/briefings/YYYY-MM-DD.md
## TODAYS_STORY, ## MARKETS, ## FX, ## EARNINGS, ## POLICY, ## ONE_LINER, ## AUTHOR.
Each item: ### headline; summary; #### Why it matters; #### Context; #### Market Implication.
Put direct Markdown source links in the relevant existing block (do not invent an unsupported top-level section).
Target about 9,000-11,000 chars, informed by recent editions; evidence outranks length.

2. international/briefings/YYYY-MM-DD.md
## TODAYS_STORY, ## US, ## CHINA, ## ME, ## EU, ## ONE_LINER, ## AUTHOR.
Same h3 and h4 blocks as financial; include direct source links and separate evidence from analysis.
Target about 9,000-11,000 chars.

3. medical/briefings/YYYY-MM-DD.md
## TODAYS_STORY, ## PAPERS, ## POLICY, ## ONE_LINER, ## AUTHOR.
Each paper: ### headline; summary; #### 어떤 연구; #### 초록; #### 주요 결과; #### 임상 적용; #### 주의할 점; #### Source.
The editorial-required abstract and source blocks are mandatory even though an older task prompt omitted them.
Read medical/_meta/covered-papers.json BEFORE choosing papers. Normalize DOI case/prefix for matching; never invent a DOI.
No repeated DOI. Discuss a material new guideline/policy update separately without pretending the old paper is new.
Reader is a nephrologist; CKD/dialysis/renal dosing implications where supported. Label evidence limitations and domestic applicability.
After the medical article is committed and verified, fetch the latest metadata SHA and append ONLY newly covered verified papers:
{"date":"YYYY-MM-DD","doi":"10.xxxx/xxxxx","title":"verified original title","journal":"journal","pubdate":"YYYY-MM"}
Preserve every existing entry and its original fields; add no duplicates. If no new DOI papers, do not make a meaningless metadata commit.
If a fresh-SHA conflict occurs, re-read, union the new entries and retry with no lost old entries.
Target about 8,000 chars. Expanded abstracts about 250-320 Korean chars per paper; key results 3-5 bullets or a compact table.

4. health/briefings/YYYY-MM-DD.md
## TODAYS_STORY, ## NUTRITION, ## EXERCISE_SLEEP, ## PARENTING, ## WELLNESS, ## ONE_LINER, ## AUTHOR.
Each item: ### headline; summary; #### 어떤 연구; #### 초록; #### 주요 결과; #### 우리 가족에 적용; #### 주의할 점; #### Source.
Use accessible Korean for family readers. No actual family health data needed. Clearly distinguish general education from individual medical advice.
Target about 6,500 chars; follow the editorial depth reference health/briefings/2026-05-08.md.

## Validation and publication

Before each category commit: verify KST date, exact h2 order, populated h3/h4 sections, sources supporting claims, AUTHOR, no NUL or credentials.
Only write today's four category paths and the strictly append-preserving medical/_meta/covered-papers.json.
No app, service worker, workflow, security setting, past briefing or rotation-state changes during daily execution.
Use the authenticated GitHub create-file or current-SHA update-file action on main. Commit each validated category immediately.
Read back that exact committed path and raw.githubusercontent.com content. Report commit SHA/link and actual verification, not an invented HTTP status.
At the end list each of the four files as published / already valid / failed / not attempted, and separately report DOI reconciliation.
Provide headline lists and identify freshness/coverage gaps. Partial publication is not full success.
App URL: https://bwkim1025.github.io/daily-briefings/
