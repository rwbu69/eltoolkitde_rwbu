# Downloader UX Review

## Summary

The downloader has the essential workflow: paste URLs, choose a format, choose an output folder, queue downloads, monitor progress, and cancel work. The main user risk is not missing functionality; it is that a simple paste action can start a large or unexpected job without enough context or confirmation.

The interface also exposes several concepts at once—URL batching, format, quality, bitrate, output folder, queue status, progress, cancellation, and cleanup. This is manageable for experienced users, but the first-use experience could be clearer and safer.

## Findings

| Priority | Finding | Why it matters | Effort |
|---|---|---|---|
| High | Playlist links are not identified before queueing | A user who intended one video can unintentionally start dozens or hundreds of downloads | Medium |
| High | `CANCEL ALL` has no confirmation or scope explanation | A misclick can stop unrelated active and pending downloads | Small |
| High | Playlist expansion is represented as a completed queue item with the message “Playlist expanded into the queue” | “Done” can imply the playlist itself downloaded successfully, while the child jobs may still be pending | Small |
| High | There is no retry action for failed items | Users must paste the URL again and rebuild the job manually | Small |
| Medium | The queue does not show a clear total summary | Users cannot quickly see “3 active, 12 pending, 4 completed, 1 failed” | Small |
| Medium | `CLEAR DONE` also removes errors and canceled items | The label does not describe everything it removes, which can cause users to lose useful failure information | Small |
| Medium | Technical error text is shown directly in compact cards | Long yt-dlp errors make the queue noisy and are difficult to scan | Small |
| Medium | Titles and URLs are truncated without a strong secondary detail view | Users may not know which similarly named item is being downloaded | Medium |
| Medium | Format and quality controls change contextually | Switching between MP4 and MP3 changes the second control, but the relationship is easy to miss | Small |
| Medium | Output-folder selection is important but visually equal to secondary settings | A missing folder blocks queueing, but the reason is only implicit through a disabled button | Small |
| Low | The queue is a narrow fixed sidebar | Long titles, playlist names, and errors are harder to understand, especially at smaller window sizes | Medium |
| Low | Status labels are visually stylized but not fully explanatory | Labels such as `FETCHING`, `CLEARED`, and `CANCELED` require interpretation | Small |
| Low | No first-use guidance or example explains accepted URL input | New users may not know whether playlists, channel links, shorts, or multiple URLs are supported | Small |

## Information-intake assessment

### Current input burden

The user must understand:

1. One or more URLs can be pasted.
2. URLs can be separated by spaces or new lines.
3. A URL may represent a playlist rather than one media item.
4. The selected format changes the relevant quality option.
5. The output folder is required.
6. Quality and bitrate defaults come from settings.
7. Downloads begin after pressing the queue button.
8. Queue-level cancellation is separate from removing completed entries.

This is a reasonable amount for a power-user tool, but too much is communicated through labels, disabled buttons, and implied behavior rather than explicit feedback.

### Recommended information hierarchy

Keep the primary flow to three decisions:

1. **What should be downloaded?** URL input and detected item count.
2. **How should it be downloaded?** Format and one relevant quality setting.
3. **Where should it go?** Output folder.

Move advanced behavior behind an optional “Advanced options” section:

- Cookies/browser authentication
- Rate limiting
- Concurrent download count
- Fallback quality behavior

The downloader should not require users to understand these options for a normal download.

## Recommended user flow

### 1. Paste and inspect

After URLs are pasted, show a compact summary before queueing:

- Number of detected URLs
- Whether any URL appears to be a playlist
- A warning such as: “This may add 42 items to the queue”
- A link or button to preview the detected items

Do not fetch full metadata on every keystroke. Inspect on blur, on an explicit “Check links” action, or immediately before queueing.

### 2. Confirm potentially large jobs

For a playlist or a batch above a reasonable threshold, show a confirmation step:

> This will add 42 downloads to the queue. Continue?

Offer:

- Continue
- Cancel
- Queue first N items, if practical later

The exact threshold should be configurable or selected after observing real usage. A fixed initial threshold such as 10 or 20 items is sufficient.

### 3. Make the primary action explicit

Use a label that describes the result:

- `CHECK LINKS`
- `QUEUE 3 DOWNLOADS`
- `DOWNLOAD 1 ITEM`

Avoid making the user infer that queueing immediately starts processing.

### 4. Monitor and recover

Each queue item should expose only the most useful information by default:

- Thumbnail or media icon
- Title
- Format
- Status
- Progress, speed, and ETA when active
- Cancel, retry, or remove action appropriate to the status

Put full URL and technical error details behind an expandable “Details” control.

## Highest-value recommendations

### 1. Add playlist detection and confirmation

**Priority:** High  
**Effort:** Medium  

Detect playlist metadata before creating child queue items. Clearly distinguish:

- One media item
- A playlist
- A batch of separate URLs

For playlists, show the item count and require confirmation for larger jobs. This directly addresses the highest-risk accidental action.

### 2. Replace the ambiguous playlist parent status

**Priority:** High  
**Effort:** Small  

Use a dedicated status such as `PLAYLIST ADDED` or `EXPANDED`, not `DONE`. Show the number of child items and their aggregate progress if possible.

### 3. Add retry failed and retry canceled

**Priority:** High  
**Effort:** Small  

Keep the original URL, format, and relevant settings with the queue item. Add a retry icon for failed items and a clear “Retry failed” batch action.

### 4. Improve cancellation safety

**Priority:** High  
**Effort:** Small  

Rename `CANCEL ALL` to `CANCEL ACTIVE` or explain its scope directly below the button:

> Stops active downloads and prevents pending items from starting.

For more than one active job, request confirmation. Keep a one-click per-item cancel action for normal use.

### 5. Split queue cleanup actions

**Priority:** Medium  
**Effort:** Small  

Use separate actions:

- `CLEAR COMPLETED`
- `CLEAR FAILED`
- `CLEAR CANCELED`

Alternatively, keep one `CLEAR HISTORY` action but show exactly which statuses will be removed.

### 6. Add an aggregate queue summary

**Priority:** Medium  
**Effort:** Small  

Show counts for active, pending, completed, failed, and canceled items. This is more useful than showing only active and pending counts.

### 7. Add a non-blocking notification area

**Priority:** Medium  
**Effort:** Medium  

Replace browser-style alerts for normal validation and operation feedback with an in-app notice. Use:

- Informational notice for playlist expansion
- Warning notice for low or missing metadata
- Error notice with a short message and expandable details

Keep technical logs available separately for troubleshooting.

### 8. Make output and format choices clearer

**Priority:** Medium  
**Effort:** Small  

Add short descriptions:

- MP4: video plus audio
- MP3: audio only
- Video-only: video without an audio track

When MP3 is selected, replace video resolution with bitrate and explain that the setting affects file size and audio quality.

### 9. Improve responsive behavior

**Priority:** Low  
**Effort:** Medium  

At narrow widths, stack the queue below the input panel or make it a collapsible drawer. Keep the primary action visible without requiring the user to scroll past a large queue.

### 10. Improve accessibility and clarity

**Priority:** Medium  
**Effort:** Small to medium  

- Add visible labels or accessible names to icon-only actions.
- Do not rely on color alone for status.
- Ensure focus order follows input, format, output, then queue action.
- Announce status changes to assistive technology where practical.
- Use plain wording alongside the stylized labels.

## Suggested implementation order

1. Add playlist detection, item counts, and a large-job confirmation.
2. Replace the playlist parent `DONE` status with a distinct expansion status.
3. Add retry actions for failed items.
4. Clarify `CANCEL ALL` scope and add confirmation for broad cancellation.
5. Add aggregate queue counts and split or rename cleanup actions.
6. Hide technical errors behind expandable details.
7. Add concise format descriptions and output-folder validation feedback.
8. Improve narrow-window layout and accessibility.

## Product decision to make before implementation

The most important UX decision is whether the downloader should be:

- **Fast by default:** queue immediately, with a warning only for playlists or large batches.
- **Safe by default:** always inspect links before creating queue items.

The recommended compromise is fast for a single media URL and safe for playlists or batches above the confirmation threshold.

## Current verdict

### Overall status: Good enough for practical use, not yet polished

The downloader is now functional and reasonably safe for normal use. Its core workflow is understandable, playlist jobs are reviewed before expansion, cancellation is available, failed items can be retried, and the queue exposes useful progress information.

It is **good enough for an early release or personal use**, but I would not consider the UI/UX fully finished for a broad public release yet.

### What is working well

- The main task is clear: provide URLs, choose a format, choose a destination, and inspect the queue.
- The downloader keeps the existing visual language consistent: colors, borders, typography, buttons, panels, and icon treatment feel like one product.
- The queue now has clearer states and recovery actions.
- Playlist and batch confirmation reduces the most serious accidental-download risk.
- The layout has a sensible desktop split and now has a windowed fallback instead of forcing every view into one fixed desktop shape.
- The information shown is relevant to downloading; there is no major unrelated feature clutter in the primary workflow.

### What still prevents a “finished” verdict

1. The queue header can still become dense because counters and three actions share the same compact panel.
2. The downloader depends on a minimum usable window size; very small windowed sizes will still require scrolling and may feel compressed.
3. The queue has useful details, but the distinction between active, pending, completed, failed, canceled, and playlist-expanded items still requires some learning.
4. Error recovery is improved per item, but there is no strong batch-level retry or clear operation history.
5. Validation feedback is inline, but some disabled states still require the user to infer why an action is unavailable.
6. The responsive layout has been improved structurally, but it still needs visual testing at several real window sizes and with long titles, long errors, and large queues.

### Design consistency verdict

**Good.** The downloader is consistent with the rest of the application’s visual system. The remaining issues are primarily spacing, density, responsive behavior, and hierarchy—not inconsistent aesthetics or mismatched components.

### UX readiness verdict

**Approximately 75–85% ready for normal use.** The exact percentage is qualitative, not a measured score. The core workflow is reliable enough, but the last portion requires polish rather than a redesign.

### Recommended remaining polish

Prioritize these before calling the downloader production-polished:

1. Test and tune the layout at defined minimum, medium, and wide window sizes.
2. Simplify or collapse queue actions when the queue column is narrow.
3. Add a batch retry-failed action.
4. Improve disabled-button explanations and short user-facing error messages.
5. Test long playlist titles, long URLs, large queues, and simultaneous active downloads.
6. Add accessibility checks for keyboard focus, icon-only controls, and status announcements.

### Final recommendation

Do not rewrite the downloader or change its visual identity. Keep the current structure and make a final responsive-polish pass. After the remaining queue-density, minimum-window, and recovery issues are addressed—and the manual scenarios pass—the downloader should be considered ready for general use.
