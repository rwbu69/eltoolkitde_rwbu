# Downloader Layout Improvement Plan

## Goal

Reduce the cramped feeling in the downloader by improving proportions, spacing, and information hierarchy while keeping the existing visual style unchanged.

## Main layout problems

- The right queue sidebar is too narrow for its counters, buttons, and queue content.
- Queue header controls are compressed and partially compete for horizontal space.
- The left panel has excessive empty space below the output folder.
- The input, format, quality, and output controls are packed into a single dense flow.
- The primary action is visually separated by a large unused area instead of staying close to the related inputs.
- Queue status information wraps awkwardly and is difficult to scan.
- The layout does not appear to adapt well when the window becomes narrower.

## Recommended layout

### 1. Use a wider queue column

Change the desktop layout from a very narrow fixed sidebar to a balanced split:

- Main input area: approximately 65–70%
- Queue area: approximately 30–35%
- Minimum queue width: enough for status counts, actions, and readable titles

The queue should shrink only until a defined minimum width, then move below the input area.

### 2. Divide the input panel into clear sections

Use three visual layout groups without changing the aesthetic:

1. **Source**
   - URL textarea
   - Link guidance
   - Link inspection result or confirmation
2. **Download settings**
   - Format
   - Resolution or bitrate
3. **Destination**
   - Output folder
   - Validation message

Use consistent vertical spacing between groups and avoid placing unrelated controls in the same row when the available width is limited.

### 3. Move the primary action closer to the form

Keep `CHECK LINKS` or `QUEUE DOWNLOADS` directly below the output-folder section with a modest gap.

Remove the large flexible spacer that pushes the action button to the bottom of the panel. The panel can still fill the available height, but the form should not feel separated from its action.

### 4. Improve format and quality proportions

On wide screens:

- Format selector: approximately 40%
- Resolution/bitrate selector: approximately 60%

On narrower screens, stack them vertically instead of squeezing both into a short row.

Keep the helper text directly below the related selector and reserve enough width for the full labels.

### 5. Restructure the queue header

Use two rows when necessary:

**Row 1**

- Queue title
- Active and pending counts

**Row 2**

- Completed, failed, and canceled counts
- Cancellation and cleanup actions

Do not allow buttons to overlap or become clipped. If space is insufficient, move cleanup actions into a compact secondary row or menu.

### 6. Improve queue item readability

Give each queue card more usable width and reduce competing text:

- First line: status and format
- Second line: title
- Third line: progress, speed, and ETA
- Details and full URL inside an expandable section

Keep the contextual action aligned to the right and reserve a stable width for it so long titles do not move controls around.

### 7. Add responsive breakpoints

Recommended behavior:

- **Wide desktop:** two-column layout with a spacious queue sidebar.
- **Medium window:** two columns with reduced gaps and simplified queue actions.
- **Narrow window:** stack the queue below the input panel.
- **Very narrow window:** stack format and quality controls and place queue actions in a separate row.

The primary action should remain visible without requiring users to scroll through the queue.

## Implementation order

1. Adjust the `PageLayout`/`Column` proportions and queue minimum width.
2. Remove the large input-panel spacer and tighten the form-to-action relationship.
3. Group source, settings, and destination sections with consistent spacing.
4. Rework the queue header into responsive rows.
5. Improve queue-card internal alignment and text wrapping.
6. Add responsive stacking breakpoints.
7. Test at the smallest supported window size and at the screenshot’s desktop size.

## Acceptance criteria

- The queue sidebar displays all counters and actions without clipping.
- The input panel does not contain a large unexplained empty region.
- The primary action is visually connected to the form.
- Format and quality controls remain readable at medium widths.
- Queue titles, status labels, and actions remain aligned.
- The interface stacks cleanly instead of becoming compressed.
- No color, typography, border, or overall visual style changes are required.

## Out of scope

- Changing the theme, colors, fonts, borders, or icon style.
- Redesigning the entire application shell.
- Adding new downloader functionality.
- Changing playlist confirmation, retry, or cancellation behavior.
