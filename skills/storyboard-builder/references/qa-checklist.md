# Storyboard QA Checklist

## Story

- Every supplied dialogue line is present and assigned to the correct speaker.
- Name replacements are complete; placeholder actor labels are gone.
- Silent reactions and background actions have dedicated cuts where pacing needs them.
- The cut order and timing match the source when source fidelity was requested.
- Fixed titles, subtitles, or overlays follow the user's explicit decision.

## Images

- There is one independently generated image per cut.
- Every image visibly depicts the listed action and reaction; notes alone do not repair a mismatched drawing.
- Every image is 16:9 and uses the same hand-drawn visual language.
- No image is a crop from a contact sheet.
- `object-fit: contain` displays the complete image.
- The central 9:16 area contains the essential face, gesture, and prop.
- Character, costume, location, and prop continuity hold across the sequence.
- Signs, screens, and props contain no accidental readable text.

## Documents

- Visible headers, scene names, actions, dialogue, and sound labels use the requested language.
- When enabled, the cover framing guide uses a real storyboard cut and clearly explains the 16:9 border, 9:16 blue dashed guides, side-crop risk, and central subject placement.
- The HTML has the expected number of cut rows and unique image references.
- Long dialogue wraps by words without overlapping or clipping.
- Each source HTML page section starts with the intended number of cuts; the PDF renderer may split rows when A4 preflight requires it.
- Mobile display may scroll horizontally, but no text or image overlaps.
- Public packages contain no local absolute paths, account names, credentials, private source filenames, or unintended identifying details.
- Copied PNG/JPEG/WebP assets contain no EXIF, XMP, comments, timestamps, or text chunks unless preservation was explicitly requested.

## PDF

- A4 page size is used.
- The A4 preflight reports no oversized cover or single-cut row.
- The page count equals the post-pagination cover and storyboard section count.
- The cover, a dense middle page, and the last page render without clipping.
- Images remain sharp after PDF optimization.
- File size is practical for sharing unless archival quality was requested.
- Temporary HTTP servers, browser sessions, and proxy assets are removed.
