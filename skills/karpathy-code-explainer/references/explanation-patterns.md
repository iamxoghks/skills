# Mechanisms, flows, and documentation

Read when deciding what to expose in an interactive explanation or reviewing its causal accuracy. These patterns come from focused puzzle/chat explanations and a whole-project frontend/backend atlas; their project-specific business rules are not reusable defaults.

## Choose controls that answer a question

Good controls vary inputs a developer actually reasons about: a date, state, route, message sender, room, failure, data-bank size, or processing stage. Show the branch and output together, then connect them to the implementing code. A stage selector is navigation; do not present it as executing the real application.

A transformation experiment may compare initial/intermediate/final data and reveal invariants. If an application uses system randomness, a seeded demonstration can explain valid transformations but cannot promise the app's exact random output. If a data bank grows, distinguish stable index selection from stable underlying data content. Checking validity is not the same as checking uniqueness.

An event experiment benefits from showing clients/subscriptions, rooms, payloads, and state ownership. Inspect how many clients are really mounted and which subscriber processes each event. A duplicate message ID may deduplicate the message list while still changing room metadata or counters. Separate persisted messages from transient events. Account for unmount/cleanup before claiming a stable subscription count.

## Review causal boundaries

Start each flow with a concrete trigger. Read the body of its handler, not just its endpoint annotation. Trace each arrow to an actual call, returned value, published event, shared-state update, or declared follow-up trigger.

Common mistakes:

- Inserting notification creation into a read-only history endpoint because both concern reservations.
- Treating SSE emitter registration as the asynchronous creation/delivery of a new notification.
- Treating a daily bulk save as the single-item endpoint with a similar name.
- Putting a midnight scheduler or retry processor into a synchronous request timeline.
- Treating an import or API wrapper's existence as proof that a screen invokes it.
- Treating absence of a direct reference as proof that code never runs.

Use a separate follow-up lane or explicit follow-up badge for callbacks/jobs/events. For each follow-up, record registration, trigger, ordering guarantees, and failure effect if established by code. Use alternatives for mutually exclusive branches. Do not flatten several independently triggered operations into one success path.

## Prove what the source supports

Every important factual claim should have a source jump. A valid line number alone is weak evidence: read the guard/body and optionally retain an exact excerpt or excerpt hash. Short excerpts around a reference can help readers check the claim; ensure full implementing code remains reachable.

Commit labels require acquisition evidence. Save full revisions and the method used to obtain the files. If local edits are included, label the source as a working copy and avoid linking modified lines to an immutable remote commit. Exact body hashes prove agreement with the selected files, not provenance on their own.

AST/parser results and regular-expression indexes have different coverage. State what was indexed and what was missed. File-to-domain membership is a navigation choice; shared files may participate in several flows. Scope statistics count the inventoried files, not the depth of every explanation.

For model verification, record which original functions ran, test inputs/results, and stubbed dependencies. A stubbed publisher test can verify calls and error handling without proving broker delivery. A browser UI test proves page interaction, not application/network correctness.

## Extend into developer documentation

Include setup and operating instructions only from repository scripts/configuration or verified commands. Keep secrets as placeholders. Separate prerequisites, optional services, and the tested local environment.

Design intent comes from ADRs, commit discussions, issue/PR records, or the team. Infer a plausible reason only when labeled as an inference. Record known bugs as source observations or reproduced failures with their evidence; creating documentation is not authorization to patch them.

For refreshes, compare revisions and file hashes, then revisit claims dependent on changed files. Recheck signatures, guards, routing, consumers, lifecycle, and line anchors. Do not update revision badges while retaining unreviewed old flow text. Preserve decision history according to the repository's documentation conventions.
