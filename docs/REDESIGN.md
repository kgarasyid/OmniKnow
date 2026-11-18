# Rev Y showcase redesign

All seven pages share refreshed navigation, cards, forms, tables, and responsive layout. Dense dashboard analyses are grouped into expandable sections.

Dashboard pre-test and post-test pies use assessmentRows(filtered()), exactly as the Pre-Post Test Evaluation page. CTP, Area/Site, geographic area, region, category, and search are shared when navigating. Both scores must be finite numbers in 0–100. Missing/invalid pairs are excluded, and empty cohorts display no data. Bins are [0,55), [55,70), [70,85), [85,100]. Percentages are rounded independently.

All records remain synthetic. Demo GraPARI agents map the four original geographic areas to Area 1–4. Demo Call Center agents alternate Site 1/2 by six-record blocks. Explicit ctpArea/site assignments take priority; imported records without assignments remain Unassigned. These are showcase assignments, not real operational mappings.

Verified: build/source byte equality; JavaScript syntax; 48 records; four GraPARI cohorts of 8/4/8/4 and two Call Center cohorts of 12/12; disjoint cohort totals; all bin boundaries; missing/invalid scores; zero data; changed scores; activity membership and imported assignments. In-browser chart totals and bins match the evaluation table for every cohort. All seven pages rendered without page overflow at observed widths 1707 and 520 pixels, with no console errors.

Run node scripts/build.mjs, node scripts/check.mjs, and node scripts/test-assessment.mjs. The Rev X baseline identity check intentionally no longer passes for edited source.

## Production verification — 4 November 2026

Published to the existing omniknow project, team kgarasyid-4449. Deployment dpl_Dr5apt11aKEMLhrFpygbyMEuHotM reached READY with omniknow.vercel.app assigned successfully. Source commit: c1dd78959728fc91abdd5e46e5d693f12494258e. Uploaded the five required source/build files through the authorized Vercel connector; no GitHub integration was created.

Public HTML equals the local source/build byte for byte: 179454 bytes, SHA-256 d8107178193ee94c7530924e6e072ead9b50ced96ce308eb8d384b51e8e55665. Live browser verified two 48-agent pies, all seven navigation entries, and Call Center Site 2 synchronizing both charts with evaluation (12 agents). No live console errors observed.

## Chart interaction update

Added Click to detail and independent Nat./Area/Region controls to each assessment chart. Nat. retains the pie; Area compares dummy GraPARI Areas and Call Center Sites; Region compares geographic regions. Existing global filters remain applied to all modes. Chart-adjacent CTP and Area/Site controls share those filters with evaluation and exports. Details show the underlying filtered agent rows and score bands.

Added pointer, keyboard-focus and touch detail tooltips to existing chart marks and data rows, including assessment pies/bars, learning charts, certification, ASK and dashboard trends. Tooltips use rendered source values, never random data. Verified real pointer hover, keyboard focus, both detail tables, grouped cohorts, empty-state details and responsive controls at actual viewport widths 1707 and 520. Extended assessment tests to check disjoint group coverage and detail-row membership for all six cohorts.

Published interaction update: deployment dpl_E11qzAqnKqvLDVUpFWHPRBVA5Wbv READY on omniknow.vercel.app; source commit 4dafcf2c3c3ef0b2e4811e13da85deff1a748c54. Public response matches source/build (189153 bytes; SHA-256 c519806c4df845e65342a3c45391100cfe03ffde7d747d65d42b5870f8dc2b16). Live detail modal verified 24 GraPARI rows; live pointer tooltip showed Below 55: 7 agents, 29.2%. No console errors observed.

## Professional chart palette

Chart series and legends now use red #C6283D, blue #245A9A, grey #7B8492 and charcoal #303844, with white dividers and neutral/light-blue supporting tones. Assessment score colors are consistent across pies, grouped bars, legends and detail summaries. Existing chart values, filters and events are unchanged. Build, source checks and assessment tests pass; browser inspection confirmed the palette across expanded dashboard charts without console errors.
