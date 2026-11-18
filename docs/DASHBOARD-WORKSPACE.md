# Dashboard categories

The landing page now starts with shared filters and six category buttons: Summary, ASK Performance, Training Hardskill & Soft skill, Training Reguler, Test Evaluation, and Raw Data Table All. Existing sidebar destinations and separate survey connections remain available.

## Data contracts

- Summary completion and certification use the filtered roster. Knowledge gain and test distributions use `assessmentRows`, exactly as Pre-Post Evaluation does, including connected paired survey snapshots when enabled.
- ASK uses 40% attitude, 30% skill, 30% knowledge. The 80-point showcase threshold is explicitly illustrative.
- Hardskill, Soft skill, ACS Booster, Bad Ticket and Reguler Try Out have deterministic, labelled dummy assignments for existing original demo IDs. Each program has 36 assignments in the initial unfiltered roster. These fixtures never mutate stored agents, activities or survey scores. Missing dummy completion scores remain blank rather than zero.
- A saved activity with an exact matching category replaces that program's dummy fallback. Only explicitly linked attendee/assessment IDs count, and only activity-specific post scores populate the program score. Create the exact category through Add Activity's existing custom category control.
- Raw Data has separate Agents, Programs and Activities tables. Program rows are assignments, not unique agents across programs. CSV exports contain all matching rows, not only the current 20-row page. Apply search or press Enter before exporting.
- Shared CTP, Area/Site, Region and agent filters persist across tabs. Geographic-area or activity filters inherited from sidebar pages remain visible in the scope line and can be cleared with Reset filters.
- Saved activities without linked agents appear only when location/agent restrictions are absent. A scheduled activity is not treated as attendance.

## Verification

Run `node scripts/build.mjs`, `node scripts/check.mjs`, `node scripts/test-dashboard.mjs`, `node scripts/test-assessment.mjs`, and `node scripts/test-survey.mjs`. After publication, `node scripts/check.mjs --live` compares all served UI assets with local source.

Browser checks covered category/subcategory navigation, CTP/site filter retention, Area chart grouping and record details, survey navigation, raw pagination and search reset. A downloaded CSV was read back: 36 Bad Ticket rows, matching the rendered result. Existing local browser storage is retained.
