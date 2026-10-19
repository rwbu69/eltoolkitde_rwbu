# ElToolkitDeRWBU Improvement Roadmap

Concise recommendations based on the project audit.

## Highest-value improvements

| Priority | Improvement | Why it is good | Possible downside | Effort |
|---|---|---|---|---|
| Critical | Authorize the `bpm_modifier` Tauri sidecar | Makes BPM modification work in the packaged app | Requires retesting release permissions | Small |
| High | Unify video-quality and bitrate settings | Prevents Preferences from saving values the downloader does not understand | May require migrating existing saved settings | Small |
| High | Add tests for downloader, rename, metadata, FFmpeg, and BPM services | Protects the most important workflows from regressions | Initial test writing takes time | Medium |
| High | Restrict Tauri filesystem and shell permissions | Reduces the impact of a compromised or misbehaving frontend | Path handling becomes more complex | Medium |
| High | Remove `--no-check-certificate` by default | Restores normal HTTPS certificate protection | Some problematic downloads may need an explicit compatibility option | Small |
| High | Make batch operations transactional | Prevents half-renamed folders and partial output files | Requires temporary files, rollback logic, and more disk space | Large |
| Medium | Decide whether to remove or isolate the legacy implementation | Reduces duplicated behavior and maintenance confusion | Removing it could break users who still depend on it | Medium |
| Medium | Improve cancellation and distinguish canceled from failed | Gives users accurate status and safer cleanup | Requires changes across multiple services and UI views | Medium |
| Medium | Replace browser alerts with shared in-app notifications | Produces a more consistent and less disruptive UX | Adds a reusable notification component | Medium |
| Medium | Make BPM detection and modification semantically reliable | Prevents misleading BPM results and audible artifacts | May require algorithm research or a larger rewrite | Large |
| Medium | Pin sidecar versions and checksums in CI | Makes release builds reproducible and safer | Updates require deliberate dependency maintenance | Medium |
| Low | Expand metadata fields beyond title, artist, album, and year | Adds value for music-library workflows | More UI and validation work | Medium |
| Low | Improve accessibility and keyboard navigation | Makes the desktop app easier to use for more people | Requires component-level review and testing | Medium |

## Good features to implement

1. **Operation history** — show recent conversions, downloads, renames, and failures.
2. **Retry failed items** — retry only failed downloads or media operations.
3. **Durable rename undo** — retain undo information until the application closes or the user clears it.
4. **Dry-run export** — save rename previews or operation plans before applying them.
5. **Manual yt-dlp update control** — provide “check for updates” and show the installed version.
6. **Per-file BPM cancellation** — cancel one BPM job without stopping the whole batch.
7. **Output collision preferences** — choose skip, overwrite, or create a numbered filename.
8. **Structured logs** — include timestamp, severity, operation, and source for each log entry.

## Recommended order

1. Fix the missing BPM sidecar permission.
2. Unify settings types and migrate invalid saved values.
3. Add service-level tests for critical workflows.
4. Remove insecure certificate bypassing.
5. Restrict Tauri capabilities and validate paths.
6. Improve cancellation and partial-output cleanup.
7. Make rename and metadata operations recoverable.
8. Decide the long-term status of the legacy implementation.
9. Make CI sidecar builds pinned and reproducible.
10. Improve BPM algorithm behavior and add representative audio tests.

## Main trade-off

The cheapest, safest gains are configuration fixes, validation, tests, and clearer error handling. A full transactional-operation system and a more reliable BPM engine would provide greater long-term quality, but they require substantially more implementation and testing than the rest of the roadmap.

## Whole-app UI and UX consistency audit

### Verdict

The application has a recognizable and mostly consistent visual identity, but the menus do not yet feel like parts of one interaction system. The main inconsistency is structural: each menu uses slightly different layout, action, status, error, and responsive patterns.

The app is visually cohesive enough for continued development, but it needs a shared layout and interaction pass before it feels fully polished.

### Findings

| Priority | Problem | Evidence | Why it feels inconsistent | Recommended direction |
|---|---|---|---|---|
| High | Different menus use different page structures | [DownloaderView.tsx](D:/script-tools/eltoolkitde_rwbu/src/components/DownloaderView.tsx), [FfmpegView.tsx](D:/script-tools/eltoolkitde_rwbu/src/components/FfmpegView.tsx), [MetadataView.tsx](D:/script-tools/eltoolkitde_rwbu/src/components/MetadataView.tsx), [RenameView.tsx](D:/script-tools/eltoolkitde_rwbu/src/components/RenameView.tsx), [BpmModifierView.tsx](D:/script-tools/eltoolkitde_rwbu/src/components/BpmModifierView.tsx) | Some menus use tabs before the main panel, some use numbered sections, and others use configuration cards. Users must relearn the visual hierarchy on every menu | Standardize each tool around title, optional mode tabs, input/configuration panel, primary action, and results/status panel |
| High | Responsive behavior is not shared consistently | [Layout.tsx](D:/script-tools/eltoolkitde_rwbu/src/components/ui/Layout.tsx), [App.tsx](D:/script-tools/eltoolkitde_rwbu/src/App.tsx) | The downloader has custom responsive rules while other menus retain fixed two-column assumptions; switching menus at the same window size can produce different density or clipping | Create shared breakpoints and a documented responsive contract for `PageLayout`, `Column`, panels, and sidebars |
| High | Action placement and cancellation patterns differ | [FfmpegView.tsx](D:/script-tools/eltoolkitde_rwbu/src/components/FfmpegView.tsx), [MetadataView.tsx](D:/script-tools/eltoolkitde_rwbu/src/components/MetadataView.tsx), [DownloaderView.tsx](D:/script-tools/eltoolkitde_rwbu/src/components/DownloaderView.tsx) | Cancel appears beside the main action in some tools, as a queue action in the downloader, and is absent or implicit in other workflows | Use one action-footer pattern: primary action, optional cancel action, disabled explanation, and progress state |
| High | Error feedback is inconsistent | Several menus call browser `alert()` while the downloader uses inline notices and the terminal log auto-opens on errors | The same kind of failure interrupts users differently depending on the menu | Replace normal validation/error alerts with a shared inline notice or notification component; reserve the system log for technical detail |
| Medium | Status vocabulary is inconsistent | Downloader uses `PENDING`, `FETCHING`, `COMPLETED`, and `CANCELED`; FFmpeg/metadata use `processing`, `done`, `error`, `skipped`; rename uses preview-specific states | Users cannot transfer their understanding of status labels from one menu to another | Define shared status labels, colors, icons, and meanings for pending, active, success, warning, error, skipped, and canceled |
| Medium | Empty states use different tone and wording | Downloader: “Queue is Empty”; FFmpeg: “Queue is empty”; metadata: “No Recent Actions”; BPM: “No files selected”; rename: “No files selected” | The same absence of work feels like different product concepts | Use a shared empty-state component with title, explanation, and next action |
| Medium | Form controls are visually similar but not behaviorally standardized | [Button.tsx](D:/script-tools/eltoolkitde_rwbu/src/components/ui/Button.tsx), [Input.tsx](D:/script-tools/eltoolkitde_rwbu/src/components/ui/Input.tsx), individual view files | Buttons and inputs share styling, but labels, helper text, disabled explanations, and validation differ between menus | Standardize field groups, helper text, error text, loading labels, and disabled reasons |
| Medium | Sidebar/result panels have different semantics | Downloader uses an active queue; rename uses preview; metadata/FFmpeg use logs; BPM uses selected files | The right side alternates between “what will happen,” “what is happening,” and “what happened” without a consistent header convention | Make panel purpose explicit with a shared `Preview`, `Progress`, `Results`, or `Activity` panel pattern |
| Medium | Navigation labels and menu titles do not follow one naming scheme | App navigation uses “Downloader,” “FFmpeg,” “Metadata,” “Rename,” “BPM,” and “Prefs”; section titles include `FFMPEG_TOOLS`, `METADATA_EDITOR`, `PROCESS_LOG`, and `METADATA_LOGS` | Users see mixed title casing, underscores, singular/plural forms, and abbreviated names | Choose one display convention: plain title case for navigation and concise uppercase section labels without underscores |
| Low | Spacing and density vary between menus | Settings uses larger section spacing and two-column grids; BPM uses dense numbered cards; FFmpeg uses configuration cards; downloader uses queue-specific controls | Switching menus changes how much content fits and how far users must scan | Define shared spacing tokens for page gaps, panel padding, section gaps, field gaps, and action-footer spacing |
| Low | The terminal log is globally fixed and can compete with every menu | [TerminalLogView.tsx](D:/script-tools/eltoolkitde_rwbu/src/components/TerminalLogView.tsx) | The same large overlay appears regardless of tool context and can obscure lower content in smaller windows | Keep the log available globally, but make its collapsed tab smaller and ensure open-state height respects the available viewport |
| Low | Top navigation changes density at a different breakpoint than content | [App.tsx](D:/script-tools/eltoolkitde_rwbu/src/App.tsx) | Navigation switches between icon-only and labeled buttons using `lg`, while content changes layout using `xl`; intermediate window sizes can feel mismatched | Align navigation and content breakpoints or define intentional intermediate behavior |

### Most important consistency problems

1. **The same task state is expressed differently.** “Done,” “completed,” “skipped,” and “applied” are not presented through one shared status model.
2. **The same error interrupts differently.** Browser alerts, inline notices, logs, and silent disabled buttons coexist.
3. **The right panel changes purpose from menu to menu.** It is sometimes a queue, preview, result list, or log without a consistent visual contract.
4. **Responsive behavior is currently menu-dependent.** A window size that works for the downloader may still feel cramped in FFmpeg, metadata, rename, or BPM.
5. **The visual system is stronger than the interaction system.** Colors, borders, and typography are consistent, but spacing, wording, and action placement are not.

### Recommended implementation order

1. Define shared status types, labels, icons, and visual meanings.
2. Standardize the page shell and responsive breakpoints.
3. Create a shared action footer with primary, cancel, loading, and disabled-reason behavior.
4. Create shared empty-state, inline-notice, and result-panel patterns.
5. Normalize navigation and section title wording.
6. Refactor each menu to the shared patterns one at a time:
   - FFmpeg
   - Metadata
   - Rename
   - BPM
   - Downloader final polish
   - Settings
7. Test every menu at wide desktop, windowed desktop, and narrow supported widths.

### Acceptance criteria for a consistent app

- Switching menus does not change the basic page structure unexpectedly.
- Every tool has a clear title, input/configuration area, primary action, and result/status area.
- Cancellation, processing, success, failure, and empty states use shared wording and visual meanings.
- No menu relies on a browser alert for routine validation.
- Every menu remains usable at the same supported window sizes.
- The terminal log does not obscure the primary action or results.
- Navigation labels and section headings follow one naming convention.
