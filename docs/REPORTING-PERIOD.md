# Reporting dates and VoC

From and To are inclusive. Default is October 2026, the showcase reporting month. MoM shifts both date boundaries back one calendar month and clamps dates to month end. For custom or multi-month ranges this is explicitly a shifted-range comparison, not a comparison of complete calendar months.

Demo roster history is generated deterministically for August, September and October 2026. The latest dated snapshot per agent in the chosen range supplies roster measures. Program assignments and feedback are event records and use their own dates, so their participant counts can differ from snapshot counts. Existing imported records need an assessmentDate or date; undated records are excluded. Connected survey pairs require both response timestamps inside the range. The connector retains latest responses rather than a complete historical response archive.

Chart MoM sections compare corresponding displayed series using the same scope and shifted dates. Counts report absolute and relative change; average scores report point and relative change. Zero baselines display `new; previous 0`. Missing history displays `No previous-period data`. Current and previous values are available by expanding the MoM section. Date ranges are included in PDF and Excel scope metadata.

VoC contains dated dummy feedback, a full-text word frequency chart, and a separate illustrative overall rating from 1 to 5. Rankings sort by average overall rating with agent ID as a deterministic tie-breaker. National, Area/Site, Region and CTP grouping respect shared filters. Top/Bottom 5 selects agents within each group and filters the detail table. Text search matches feedback, name, NIK and topic. CSV detail exports retain the selected response rows.

Run `node scripts/test-period.mjs` for inclusive-date, month-end, empty-range, multiple-month, feedback search and grouping regression checks.
