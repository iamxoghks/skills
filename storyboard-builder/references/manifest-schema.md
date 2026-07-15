# Storyboard Manifest

Use UTF-8 JSON. Copy the primary Korean
`assets/storyboard.template.json` into the project. Use
`assets/storyboard.template.en.json` for an English document. Use
`examples/sample-storyboard.json` and `examples/sample-storyboard-en.json`
only as runnable references.

## Build Command

    SKILL_DIR="$HOME/.codex/skills/storyboard-builder"
    python3 "$SKILL_DIR/scripts/storyboard_builder.py" storyboard.json \
      --output-dir outputs \
      --basename project-storyboard

The builder validates every cut, copies images into `<basename>_assets/`,
removes common personal and editor metadata from PNG/JPEG/WebP assets, and
writes `<basename>.html` and `<basename>.md`.

Use `--preserve-image-metadata` only when EXIF, XMP, comments, or text chunks
are intentionally required. The basename may contain Unicode and spaces but
must not contain `/`, `\\`, `.` as the complete name, or `..` as the complete
name.

## Top-Level Fields

Required:

- `title`: document title
- `cuts`: non-empty cut array

Optional:

- `format`: short concept or production format
- `estimated_duration`: display duration
- `cast`: character-name array
- `shooting_notes`: cover-page note array
- `include_cover`: defaults to `true`
- `include_framing_guide`: adds a first-cut framing legend to the cover; requires `include_cover`
- `cuts_per_page`: defaults to `4`
- `html_lang`: the Korean template uses `ko`; omitted values fall back to `en`
- `labels`: overrides visible field labels

## Cut Fields

Required:

- `number`: optional; defaults to array order
- `start`: start timecode
- `end`: end timecode
- `duration`: localized display duration such as `4 sec` or `4초`
- `scene`: short scene name
- `shot`: localized shot-size or camera description
- `action`: actor, background, and prop behavior
- `dialogue`: speaker-prefixed dialogue or a localized value such as `None.` or `없음.`
- `sound`: music, ambience, and sound effects
- `image`: path relative to the manifest or an absolute path

Optional:

- `vertical_crop`: what must remain inside the central 9:16 area

## Custom Labels

The builder selects English labels by default and Korean labels when
`html_lang` begins with `ko`. Override any bundled label when another language
or production vocabulary is required:

    "labels": {
      "cut": "Plan",
      "picture": "Image",
      "action": "Mise en scene",
      "dialogue": "Texte",
      "sound": "Son"
    }

Keep all visible document language consistent with the user's request.

## Cover Framing Guide

Set `include_framing_guide` to `true` to place the first storyboard image on
the cover with a localized legend. The legend identifies the black 16:9 frame,
the blue dashed 9:16 safe area, side regions that may be cropped, and the rule
for keeping essential faces, gestures, and props in the center. Override the
`guide_title`, `guide_frame`, `guide_safe`, `guide_sides`, or `guide_subject`
label keys only when project vocabulary requires different wording.

## PDF Command

    python3 "$SKILL_DIR/scripts/render_storyboard_pdf.py" \
      outputs/project-storyboard.html \
      outputs/project-storyboard.pdf

The renderer uses A4 print CSS, waits for fonts and images, compresses image
proxies to a print-safe size, and automatically moves overflowing cut rows to
additional pages. It verifies page count with `pypdf` or `pdfinfo` when either
is available. Use `--no-auto-paginate` to make any page overflow fail without
splitting.
