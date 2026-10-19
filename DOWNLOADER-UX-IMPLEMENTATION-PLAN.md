# Downloader UX Implementation Plan

## Goal

Make the downloader safer for accidental playlist downloads, easier to understand at a glance, and faster to recover when something fails—without turning a simple download into a complicated wizard.

The recommended product behavior is:

- Single media URLs remain fast to queue.
- Playlists and large batches require a clear confirmation.
- Advanced settings stay out of the primary workflow.
- Queue actions explain their scope before destructive or broad operations.

## Scope

### Included

- Playlist and batch inspection
- Large-job confirmation
- Clearer queue states and summaries
- Safer cancellation
- Retry actions
- Better cleanup controls
- More readable errors and item details
- Clearer format and output-folder guidance
- Responsive and accessibility improvements

### Not included in the first pass

- Download history across application restarts
- Account synchronization
- A full download scheduler
- Per-playlist filtering by search or sort
- Replacing yt-dlp with another downloader
- A major visual redesign

## Phase 1: Define the state model and UX contract

**Priority:** High  
**Effort:** Small

Before changing the UI, make the intended states explicit.

### Queue states

Use distinct meanings for:

- `pending` — waiting for an available slot
- `fetching` — metadata is being inspected
- `downloading` — media transfer is active
- `expanded` — a playlist parent was inspected and child items were created
- `done` — this specific media item completed
- `error` — this item failed
- `canceled` — this item was intentionally stopped

The current playlist parent behavior should not use `done` for expansion.

### Queue item data

Retain enough information to support recovery and explanation:

- Original URL
- Resolved media URL when available
- Display title
- Format
- Output directory
- Relevant quality or bitrate
- Playlist identifier and item count, when applicable
- Error message
- Retry eligibility

Do not persist active queue items unless durable queue recovery is intentionally added later.

### Acceptance criteria

- Every visible status has one unambiguous meaning.
- A user can tell whether an item completed, was expanded, failed, or was canceled.
- Retry can reuse the original item configuration.

## Phase 2: Add link inspection and playlist safety

**Priority:** High  
**Effort:** Medium

### User flow

1. User pastes one or more URLs.
2. The UI counts the parsed URLs.
3. The user can choose `CHECK LINKS`, or queue directly for a normal single URL.
4. The application fetches metadata only when needed.
5. The UI reports whether each URL is:
   - A single media item
   - A playlist
   - Invalid or unavailable
6. A playlist displays its item count before child downloads are created.

### Confirmation rule

Use a safe default:

- One ordinary media URL: no confirmation required.
- Multiple URLs or any playlist: show a summary before expansion.
- Large job above a threshold: require explicit confirmation.

Start with a threshold of 10 items, but keep the threshold in one named constant so it can be adjusted after real usage.

### Confirmation content

Show:

- Number of source URLs
- Number of estimated downloads
- Playlist title, if available
- Selected format
- Output folder
- A warning when the count is unknown or unusually large

Actions:

- `CANCEL`
- `QUEUE DOWNLOADS`

### Edge cases

- If playlist count is unavailable, say so instead of implying a small job.
- If one URL fails inspection, keep the other valid URLs reviewable.
- Do not create child queue items until confirmation is complete.
- Canceling inspection must not leave a partially expanded playlist.

### Acceptance criteria

- Pasting a playlist never silently creates a large queue.
- Confirmation shows an understandable item count.
- Canceling the confirmation leaves the queue unchanged.
- A failed metadata lookup has an actionable message.

## Phase 3: Simplify the primary input panel

**Priority:** Medium  
**Effort:** Small

### Primary controls

Keep the first view focused on:

1. URL input
2. Format
3. Relevant quality control
4. Output folder
5. Queue action

Change the main button label based on the input:

- `CHECK LINKS`
- `QUEUE 1 DOWNLOAD`
- `QUEUE 4 DOWNLOADS`

Do not show technical settings in this primary block.

### Format descriptions

Add short helper text:

- **MP4:** video with audio
- **MP3:** audio only
- **Video-only:** video without audio

When MP3 is selected, show bitrate. For video formats, show resolution.

### Validation feedback

If the output folder is missing, explain it next to the disabled action:

> Select an output folder before queueing downloads.

If the URL field contains invalid or empty tokens, identify them before queueing.

### Acceptance criteria

- A first-time user can identify the required inputs without opening settings.
- The primary action explains what will happen.
- No disabled button lacks a visible reason.

## Phase 4: Improve queue scanning and summaries

**Priority:** Medium  
**Effort:** Small

### Queue header

Show aggregate counts:

- Active
- Pending
- Completed
- Failed
- Canceled

Keep the header compact and prioritize active and failed counts.

### Queue item layout

Default visible content:

- Status
- Title
- Format
- Progress, speed, and ETA while active
- One contextual action

Move secondary details behind an expandable section:

- Original URL
- Output path
- Playlist relationship
- Full technical error

### Status wording

Use plain text alongside styled labels:

- `FETCHING DETAILS`
- `DOWNLOADING`
- `ADDED FROM PLAYLIST`
- `COMPLETED`
- `FAILED`
- `CANCELED`

Do not use `CLEARED` as the completed status. `Cleared` describes removal from the queue, not download success.

### Acceptance criteria

- Users can scan the queue without reading long URLs or technical logs.
- Long titles do not push controls out of view.
- Status is understandable without relying on color.

## Phase 5: Make cancellation and cleanup safer

**Priority:** High  
**Effort:** Small

### Per-item cancellation

Keep one-click cancellation for an active item. Change the action label or accessible name based on state:

- Active/fetching: `Cancel download`
- Pending: `Remove from pending queue`
- Completed/failed/canceled: `Remove from history`

### Global cancellation

Rename or clarify `CANCEL ALL`:

> Stops active downloads and prevents pending downloads from starting.

Require confirmation when multiple items are active or pending. The confirmation should state the exact count affected.

### Cleanup actions

Preferred controls:

- `CLEAR COMPLETED`
- `CLEAR FAILED`
- `CLEAR CANCELED`

If separate buttons create too much clutter, use a `CLEAR HISTORY` menu with a status summary.

### Acceptance criteria

- Users know whether pending items will be stopped.
- A broad cancel action cannot be mistaken for canceling only the selected item.
- Cleanup does not silently remove failures users may need to inspect.

## Phase 6: Add retry and recovery

**Priority:** High  
**Effort:** Small

### Per-item retry

For failed items, show `RETRY`. Reuse:

- Original URL
- Format
- Quality or bitrate
- Output directory
- Authentication settings currently selected

For canceled items, show `RETRY` only if the user explicitly wants to resume/restart.

### Batch retry

Add `RETRY FAILED` when at least one failed item exists. Confirm the count before restarting several items.

### Error presentation

Show a short, user-oriented error first:

- “Authentication required”
- “Video unavailable”
- “Output folder is not writable”
- “Download canceled”

Keep the raw yt-dlp error in expandable details and logs.

### Acceptance criteria

- Users do not need to paste failed URLs again.
- Retrying does not duplicate successful items.
- A retry clearly starts a new attempt.

## Phase 7: Responsive layout and accessibility

**Priority:** Medium  
**Effort:** Medium

### Responsive behavior

At narrow widths:

- Stack the queue beneath the input panel, or
- Make the queue a collapsible drawer.

Keep the primary queue action visible and avoid forcing users to scroll through the entire queue to reach it.

### Accessibility

- Add accessible names to icon-only cancel, remove, and retry buttons.
- Use `aria-live` for important status changes.
- Ensure keyboard focus moves logically through input, format, quality, output, and action.
- Provide text labels in addition to color and icons.
- Ensure confirmation dialogs trap focus and support Escape/cancel.

### Acceptance criteria

- The core flow is usable without a mouse.
- Status changes are understandable through text or assistive technology.
- The queue remains usable at the smallest supported window size.

## Technical touchpoints

Likely implementation areas:

- [DownloaderView.tsx](D:/script-tools/eltoolkitde_rwbu/src/components/DownloaderView.tsx): primary UI, summaries, confirmations, queue actions
- [useAppStore.ts](D:/script-tools/eltoolkitde_rwbu/src/store/useAppStore.ts): queue state, retry, cancellation, playlist expansion
- [ytdlp.ts](D:/script-tools/eltoolkitde_rwbu/src/services/ytdlp.ts): metadata inspection, playlist data, typed errors
- Shared dialog/notification components: confirmations and non-blocking feedback
- [ProgressBar.tsx](D:/script-tools/eltoolkitde_rwbu/src/components/ui/ProgressBar.tsx): status wording and accessible progress

Reuse existing layout, button, tabs, and path-picker components before introducing new UI primitives.

## Testing plan

### Unit tests

- URL parsing and empty-token handling
- Playlist item count handling
- Large-job threshold behavior
- Confirmation cancel leaves queue unchanged
- Playlist expansion creates the expected child items
- Retry preserves original options
- Cancel-all affects active and pending items only
- Cleanup actions remove only their intended statuses

### Component tests

- Single URL flow
- Multiple URL flow
- Playlist confirmation
- Failed item retry
- Error details expansion
- Narrow layout or responsive queue behavior where practical

### Manual acceptance scenarios

1. Paste one video URL and queue it.
2. Paste a playlist URL and cancel confirmation.
3. Confirm a small playlist.
4. Attempt a large playlist and verify the warning.
5. Start several downloads and cancel one.
6. Cancel all and verify pending items do not start.
7. Fail one item and retry it.
8. Clear completed items while keeping failed items.
9. Use MP3 and MP4 with different quality controls.
10. Run the core flow in a narrow window using keyboard navigation.

## Recommended delivery order

### Release 1: Safety and recovery

1. Explicit queue states
2. Playlist/large-job confirmation
3. Clear cancellation scope
4. Retry failed items
5. Correct cleanup labels

### Release 2: Clarity and density

1. Aggregate queue counts
2. Expandable details and errors
3. Format descriptions
4. Output-folder validation
5. Improved status wording

### Release 3: Polish

1. Responsive queue layout
2. Accessibility improvements
3. Non-blocking notifications
4. Additional component coverage

## Definition of done

The downloader UX revision is complete when:

- A playlist cannot silently create a large download job.
- Users can understand the queue status without technical knowledge.
- Users can cancel one item or the entire pending/active workload with clear scope.
- Failed downloads can be retried without re-entering URLs.
- Cleanup actions do not remove information unexpectedly.
- The core workflow passes the listed automated and manual tests.
