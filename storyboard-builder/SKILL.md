---
name: storyboard-builder
description: Turn reference videos or scripts containing dialogue, framing, and character actions into production-ready shot-by-shot storyboards. Use when Codex must preserve source timing and composition when video exists, or design cuts, timing, framing, blocking, and silent reactions from a script or brief when no video is available; then generate original hand-drawn 16:9 frames with 9:16-safe composition and deliver localized HTML, Markdown, or paginated A4 PDF shooting boards.
---

# Storyboard Builder

Create a shootable storyboard from source analysis through individual artwork, localized production notes, and verified paginated deliverables.

## Accepted Inputs

- A reference video, with or without adapted dialogue, for preserving shot order, timing, composition, poses, and movement.
- A script that describes dialogue, framing, character actions, reactions, props, or scene transitions.
- A dialogue-only script or production brief. When no video exists, design the missing shot structure, blocking, silent behavior, and approximate timing from the supplied material and state any important assumptions.
- Existing storyboard pages or visual references for structure and style analysis, without copying copyrighted frames into final artwork.

Treat video as optional. Do not require or fabricate source-video details when a script or brief provides enough information to design a shootable sequence.

## Required Workflow

1. Identify the input mode and inspect every supplied source before planning.
   - When a video is supplied, probe duration, resolution, frame rate, shot changes, and key poses.
   - For local video files, read [references/video-analysis.md](references/video-analysis.md) and use `scripts/analyze_video.py` when FFmpeg is available.
   - Sample video frames only for timing and composition analysis.
   - When a script is supplied, read the complete dialogue and extract every explicit character action, reaction, framing note, prop, transition, naming, language, and export constraint.
   - When only dialogue or a brief is supplied, create the missing visual beats and approximate timing before building the shot list.
   - If adapted dialogue closely follows the source, preserve the source shot order and approximate timing unless the user asks for a rewrite.

2. Build a detailed shot list.
   - Give each camera beat its own cut.
   - Split setup, gesture, prop handling, interruption, reveal, and response into separate cuts.
   - Include silent glances, frozen reactions, hesitation, listening, and background behavior.
   - Record cut number, start, end, duration, scene name, shot size, action, vertical-crop note, dialogue, sound, and image plan.
   - Apply character-name replacements globally before generating documents.

3. Generate every storyboard image separately.
   - Read [references/visual-direction.md](references/visual-direction.md) first.
   - Load the image-generation skill and, when available, the hand-drawn illustration skill for visual calibration.
   - For cinematic storyboards, human character and costume continuity takes priority over mascot defaults from a general illustration skill.
   - Create one original 16:9 image per cut. Never crop panels from a multi-image sheet.
   - Do not place readable dialogue, titles, logos, or copyrighted frames inside the drawings.

4. Build the storyboard documents.
   - Read [references/manifest-schema.md](references/manifest-schema.md).
   - Copy the primary Korean [assets/storyboard.template.json](assets/storyboard.template.json) into the project and replace every placeholder. Use [assets/storyboard.template.en.json](assets/storyboard.template.en.json) when the requested document language is English.
   - Use the primary Korean [examples/sample-storyboard.json](examples/sample-storyboard.json) and [examples/sample-storyboard.html](examples/sample-storyboard.html) only as runnable output examples. The corresponding English examples use the `sample-storyboard-en` basename.
   - Store the completed manifest beside the project or in a work directory.
   - Run:

        SKILL_DIR="$HOME/.codex/skills/storyboard-builder"
        python3 "$SKILL_DIR/scripts/storyboard_builder.py" storyboard.json \
          --output-dir outputs \
          --basename project-storyboard

   - The generator strips common personal and editor image metadata by default, writes HTML and Markdown, uses `object-fit: contain`, and creates exact page sections.

5. Render the PDF.
   - Read [references/pdf-output.md](references/pdf-output.md).
   - Use the bundled renderer. It discovers the Codex Playwright skill, `playwright-cli`, or `npx @playwright/cli`:

        python3 "$SKILL_DIR/scripts/render_storyboard_pdf.py" \
          outputs/project-storyboard.html \
          outputs/project-storyboard.pdf

   - Keep the default optimized image proxies unless the user requests archival image quality.
   - Keep automatic A4 pagination enabled. The renderer moves overflowing cut rows to additional pages and fails when one cut or the cover cannot fit.

6. Verify before delivery.
   - Read [references/qa-checklist.md](references/qa-checklist.md).
   - Render the PDF pages to PNG and inspect the cover, one dense middle page, and the last page.
   - Confirm image-action alignment, image count, missing references, page count, names, language, 16:9 dimensions, word wrapping, and console errors.
   - Stop temporary servers and remove temporary print assets.

## Default Decisions

- Default to four cuts per A4 portrait page plus an optional cover.
- Enable `include_framing_guide` when the cover should explain the full 16:9 frame, central 9:16 safe area, side-crop risk, and subject-placement rule using the first storyboard image.
- Match visible labels to the user's requested language. The builder includes English and Korean label sets; provide custom labels for other languages.
- Keep the essential face, gesture, or key prop between the central 9:16 guide lines.
- Use no fixed title overlay when the user removes it; keep document headers separate from video overlays.
- Preserve source footage as analysis material, not final storyboard art, unless the user explicitly requests frame captures and has the right to use them.
- Treat image generation as an external service boundary. Do not include personal, confidential, or identifying source details unless they are necessary for the requested result.
- Keep reusable manifests and distributable packages free of local absolute paths, account names, credentials, and project-specific source filenames.
- Preserve image metadata only when the user explicitly needs it; use `--preserve-image-metadata` as an opt-out from the privacy default.
- Deliver the manifest, image folder, HTML, Markdown, and PDF when the task asks for a reusable production package.
