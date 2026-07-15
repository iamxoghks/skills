# Storyboard Visual Direction

## Image Contract

- Generate one standalone image for one cut.
- Use exact 16:9 horizontal composition.
- Keep the central 9:16-safe area readable with two subtle blue dashed vertical guides.
- Use pure white background and loose, slightly wobbly black pen lines.
- Add only sparse red or orange action emphasis and sparse blue state or crop marks.
- Draw expressive human figures as cinematic storyboard sketches.
- Preserve generous margins and the complete framing; never zoom to fill a mismatched cell.
- Keep readable text, captions, logos, watermarks, and real interface copy out of the drawing.

## Base Prompt

Use this as the stable prefix, then append one cut-specific cinematic beat:

    Generate one standalone rough hand-drawn director's storyboard frame,
    16:9 horizontal landscape. Pure white background, loose slightly
    wobbly black pen line art, sparse blue crop-guide marks, and very
    limited red or orange emphasis. Human figures should look like quick
    cinematic storyboard sketches, expressive but not cute, not polished
    vector art, and not geometric wireframes. Keep the main action in the
    central 9:16-safe area and show two subtle dashed blue vertical guide
    lines. Preserve generous margins and show the full composition without
    zooming or cropping. No written words, letters, captions, logos,
    readable interface text, copyrighted likenesses, or watermark.

Append:

- scene and action
- shot size and camera position
- who is speaking and who is reacting
- costume, hair, location, and prop continuity
- the exact central-safe subject
- one-beat-only instruction

## Continuity

- Establish costume and hairstyle descriptions in the first character cuts.
- Repeat those descriptions in every replacement or late-sequence prompt.
- Keep the location layout, set dressing, key props, and wardrobe consistent.
- Reuse generated images as visual references when the image tool supports it.
- Regenerate a cut when its action or pose does not match the shot list, or when the character role, costume, age, setting, or prop changes unexpectedly.

## Reaction-Cut Heuristics

- Pressure line: speaker close shot, location-wide tension, listener eye movement, peer glance.
- Task action: reach for a prop or device, prepare the action, hesitate, get interrupted, freeze.
- Argument: complaint, peer reaction, silent listener, smile, over-shoulder exchange.
- Reveal: preparation gesture, hero prop or screen reveal, immediate reaction, activity montage, task completion, closing frame.

## Avoid

- Multi-panel sheets later cropped into individual frames.
- Angular wireframes, rigid vector figures, presentation diagrams, and placeholder boxes.
- Overfilled backgrounds or subjects touching the image border.
- Inconsistent wardrobe or abrupt character redesigns.
- Wardrobe that conflicts with the intended audience, setting, safety requirements, or age rating.
- Text generated inside signs, screens, or props. Add exact text during filming or post-production instead.
