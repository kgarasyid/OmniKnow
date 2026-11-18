# Dashboard redesign QA — 2026-11-18

final result: passed

## Reference and scope

Source visual truth: user-provided `C:/Users/Kgs Abdul Rasyid/Downloads/video.mp4` and `C:/Users/Kgs Abdul Rasyid/Downloads/Ticketing Export - Morvia Apps.pdf`.
Local reference captures: `artifacts/redesign/video-01.png`, `video-02.png`, `video-03.png` and `reference.png`.
Implementation: `artifacts/redesign/summary-desktop.png` and `summary-narrow.png`.
Combined comparison: `artifacts/redesign/comparison.png` (source and implementation viewed together).

This is an adaptation of the corporate dashboard's information hierarchy, filter panel, category navigation and contained chart cards, not a pixel clone of its ticketing content. The requested OmniKnow categories and existing red/blue/grey palette take precedence over the reference's teal and magenta. Corporate source data is neither imported nor published.

## Visual comparison

- Desktop measured CSS viewport: 1707 x 960, devicePixelRatio 1.125; source video frames 1280 x 720. Combined comparison normalizes each frame proportionally to 1000 pixels wide; video browser chrome and recorded screen perspective remain visible and are not counted as implementation defects.
- Narrow viewport actually reported 520 CSS pixels despite requesting 390; no document horizontal overflow. This verifies the narrow breakpoint, not a true 390px device. Cards stack, filters use two columns, and six category buttons remain visible in two rows.
- Typography: retained existing app font; title, category title, KPI and supporting text form distinct levels. Full-resolution desktop capture used to verify labels and card text in addition to the normalized comparison.
- Layout: compact dark filter header, red active category, four aligned KPI cards, then two-column supporting charts. Details appear under dedicated categories rather than an uninterrupted landing-page stream. No overlap or clipped controls observed at tested sizes.
- Color: red #C8202E, blue #1B4F8A/#2F6DB5, grey #6B7280, charcoal #374151, white card surfaces. Existing OmniKnow brand/sidebar retained intentionally.
- Assets: no new decorative imagery required; existing application identity and data-driven charts retained. Corporate brand assets were not copied.
- Content: six requested labels and all requested subcategories present. Dummy program scores clearly separated from paired assessment scores. No fabricated corporate metrics or dates presented as current operational data.

## Interaction findings and fixes

- Fixed P2: switching from a program shortcut to Agents retained the previous program search and produced a misleading empty table. Dataset changes now clear the table search. Post-fix browser result: 48 agent rows.
- Fixed P2: change-on-blur search could consume the first export click. Search now uses an explicit form with Apply search and Enter submission. Post-fix rendered result and downloaded CSV both contain 36 Bad Ticket records.
- Grouping, detail modal and the separate Pre/Post survey connection page were tested. Six CTP/location cohorts, source preservation, blank-state handling, saved-activity precedence and all category renders pass automated checks.
- Raw pagination verified page 2 of 3 for 48 agents. Shared filter tested Call Center / Site 1 across ASK, training and assessment tabs. Browser console: no errors observed.

## Remaining limits

- True 390px mobile viewport was not verified because the host reported 520px. No unresolved issue at observed viewport sizes.
- Showcase program fixtures are illustrative; connecting real category-specific feeds is outside this layout request.

## Implementation checklist

- [x] Six categories and required subcategories
- [x] Shared filters and consistent data sources
- [x] Charts, drill-down and readable raw records
- [x] CSV exported and inspected
- [x] Existing assessment and survey tests pass
- [x] Reference and rendered comparison reviewed
