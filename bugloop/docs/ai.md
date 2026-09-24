# AI assistant

AI in Bugloop helps people write and understand reports. It never decides anything that belongs
to QA, engineering or management. Every AI output is labelled, editable, and applied only when a
person clicks.

## 1. Bug-report drafting

### Flow

1. On **Report bug** the QA analyst writes what happened in their own words, and optionally
   selects a project/module and adds screenshots.
2. **Draft report** sends the text, the images, the fields already filled in, and the project
   context (module and feature names, environments, severity definitions) to the assistant.
3. The assistant returns a structured draft: title, summary, steps, expected result, actual
   result, suggested module/feature, environment details, a severity *suggestion* with its
   rationale, **screenshot observations**, and **questions for missing information**.
4. The draft fills the form. Each filled field carries a provenance chip. Questions appear inline;
   answering them and clicking **Update draft** runs the assistant again with the answers.
5. The analyst edits anything and submits. The bug records that it was AI-assisted, which fields
   the assistant drafted, which inferred fields the analyst confirmed, and which fields the
   analyst edited afterwards. The server validates this metadata; it is not free-form.

### Provenance labels

| Source | Label shown | Meaning |
|---|---|---|
| `reporter` | Provided by QA analyst | Taken from the analyst's text or selected fields |
| `screenshot` | Observed in screenshot | Plainly visible in an attached image; on-screen text quoted exactly |
| `ai_wording` | AI-generated wording | Reworded or structured, but only from facts the analyst provided |
| `ai_inferred` | AI-inferred, please confirm | A reasonable reading of what the analyst implied (typically the expected result, or a "Go to …" first step). Highlighted until the analyst confirms or edits it. On the submitted bug it reads *AI-inferred, confirmed by reporter* or *AI-inferred, not confirmed*, so engineers know how much to trust it. |

### Rules given to the model

* Never invent facts. Use only the analyst's words, the selected fields and what is plainly
  visible in the images.
* Ask instead of assuming. Missing steps, expected result, environment, frequency or the
  affected record become questions, not guesses.
* Screenshots are evidence, not proof. Describe what is visible (messages quoted verbatim,
  values, UI elements, layout problems, validation or status indicators). Do not claim things a
  single image cannot show, such as "the save failed".
* Keep the analyst's meaning. Titles describe the symptom and where it happens, with no blame
  and no "Bug:" prefix.
* Severity is only a suggestion with a rationale. The analyst chooses.

### Deterministic guardrail

After the model responds, the server checks the fields that models most often hallucinate:
environment, browser, device, OS, build/version and URL. A value is kept only if the analyst
typed or selected it, it appears in their text, or it is marked as observed in a screenshot.
Anything else is dropped and turned into a question. The check is independent of the model and
runs for every provider.

## 2. Screenshot intelligence

With a vision-capable provider, images go to the model with the report (the platform or server
downsizes them). The model lists observations by kind (error message, UI element, page/module,
value, layout, validation message, status indicator), quotes on-screen text, marks unreadable
parts as unclear, and ties each observation to an image. Observations appear under the evidence
section and can be used as the actual result, but only when the analyst chooses to.

Without a vision provider, screenshots are still attached as evidence and the assistant says it
could not analyse them. It never pretends.

## 3. Duplicate detection

Duplicate detection is deterministic, explainable, and works without any AI service.

* **Text similarity.** TF-IDF cosine over title (weighted ×2), actual result, description and
  steps, with light stemming, a stop-word list, and a small lexicon of common bug concepts
  ("doesn't save", "reverts", "old value is back" → *persistence failure*; "crash", "blank
  page", "timeout", "permission denied", …) so different wording of the same symptom still
  matches.
* **Title trigram overlap** catches typos and short titles.
* **Context boosts:** same module, same feature, and module named in the other bug's text.
* **Scope:** the same project by default. Closed bugs are included and labelled, since a match
  with a closed bug may mean a **regression** ("this looks like BUG-000087, closed 3 weeks ago").
* **Output:** High / Medium / Low similarity, the shared terms, and the shared context,
  so a person can judge quickly.

It runs live as the analyst types (right rail), again at submission (dialog when High/Medium
matches were not reviewed), and after submission against every open bug to catch simultaneous
reports. The system never rejects a report as a duplicate. People decide, and the reporter's
decision (*it's different* / *added my evidence to the existing bug*) is stored on the report
so triage can see it.

## 4. Other AI features

| Feature | Status | Where | Guardrails |
|---|---|---|---|
| Activity summary | Built | Bug detail → *Summarize* | Summarizes only the timeline and comments shown; states the current status and who is waiting; labelled AI |
| Regression suggestions | Built | Regression panel | Suggests checks derived from the report steps and fix summary; QA chooses what to run |
| Severity suggestion | Built (part of drafting) | Report form | Rationale shown; never auto-applied |
| Release risk summary | Built | Dashboard (PM, lead) | Summarizes open high-severity, reopened and overdue bugs for a project; numbers come from the database, not the model |
| Root-cause patterns | Next | Bug detail / analytics | Would cluster fixed bugs by module, root cause and resolution text; suggestions only |
| Trend analysis | Next | Analytics | Recurring modules and concepts from the similarity index; narrative optional |

## 5. Providers

All features call one interface (`src/server/ai/provider.ts`). Prompts and output schemas are
shared, so behaviour is the same everywhere.

| Provider | When | Notes |
|---|---|---|
| **Anthropic API** | Server with `ANTHROPIC_API_KEY` | Official SDK, `claude-opus-5` by default (`BUGLOOP_AI_MODEL`), structured JSON output validated with Zod, images sent as base64, refusal handling |
| **Claude in the artifact** | Published demo (claude.ai) | Uses the artifact runtime's `sample` capability. The viewer consents and uses their own Claude plan. Images are sent when the view supports them. |
| **Offline assistant** | No AI available | Rule-based: splits the analyst's own sentences into steps, expected and actual results, and asks for everything else. It cannot analyse images and says so. It never adds information. |

Every request is logged in `ai_requests` (feature, provider, model, duration, token counts,
errors). Prompt text and images are not stored.

## 6. Adding an AI feature

1. Add a prompt builder and Zod output schema to `src/server/ai/prompts.ts`.
2. Add the method to the provider interface. Implement it for the Anthropic and artifact
   providers (shared prompt) and give the offline assistant a deterministic fallback.
3. Expose it through `src/server/services/ai.ts`, which enforces permissions, logs usage,
   and applies guardrails.
4. Label the output in the UI with its source and keep a human decision between the output and
   any change to data.
