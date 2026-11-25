BEGIN;

CREATE SCHEMA reporting;

CREATE TABLE reporting.report_period (
    report_month date PRIMARY KEY CHECK (EXTRACT(DAY FROM report_month) = 1),
    active_release_id bigint
);

CREATE TABLE reporting.import_batch (
    batch_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    report_month date NOT NULL REFERENCES reporting.report_period,
    source_key text NOT NULL CHECK (btrim(source_key) <> ''),
    object_key text NOT NULL CHECK (btrim(object_key) <> ''),
    sha256 text NOT NULL CHECK (sha256 ~ '^[0-9a-f]{64}$'),
    parser_version text NOT NULL CHECK (btrim(parser_version) <> ''),
    coverage_start date NOT NULL,
    coverage_end date NOT NULL CHECK (coverage_end >= coverage_start),
    cutoff_at timestamptz NOT NULL,
    received_at timestamptz NOT NULL DEFAULT current_timestamp,
    uploaded_by text NOT NULL CHECK (btrim(uploaded_by) <> ''),
    status text NOT NULL DEFAULT 'received'
        CHECK (status IN ('received', 'validated', 'rejected')),
    rows_read integer CHECK (rows_read >= 0),
    rows_accepted integer CHECK (rows_accepted >= 0),
    rows_excluded integer CHECK (rows_excluded >= 0),
    CHECK (status <> 'validated' OR (
        rows_read IS NOT NULL AND rows_accepted IS NOT NULL AND rows_excluded IS NOT NULL
        AND rows_read = rows_accepted + rows_excluded
    )),
    UNIQUE (report_month, source_key, sha256, parser_version),
    UNIQUE (report_month, source_key, batch_id)
);

CREATE TABLE reporting.import_issue (
    issue_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    batch_id bigint NOT NULL REFERENCES reporting.import_batch,
    sheet_name text,
    row_number integer CHECK (row_number >= 1),
    code text NOT NULL,
    severity text NOT NULL CHECK (severity IN ('warning', 'blocking')),
    review_note text
);

CREATE TABLE reporting.report_release (
    release_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    report_month date NOT NULL REFERENCES reporting.report_period,
    revision integer NOT NULL CHECK (revision >= 1),
    revision_reason text NOT NULL CHECK (btrim(revision_reason) <> ''),
    created_at timestamptz NOT NULL DEFAULT current_timestamp,
    published_at timestamptz,
    published_by text,
    CHECK ((published_at IS NULL) = (published_by IS NULL)),
    UNIQUE (report_month, revision),
    UNIQUE (report_month, release_id)
);

ALTER TABLE reporting.report_period ADD CONSTRAINT active_release_same_month
    FOREIGN KEY (report_month, active_release_id)
    REFERENCES reporting.report_release (report_month, release_id);

CREATE TABLE reporting.release_source (
    release_id bigint NOT NULL,
    report_month date NOT NULL,
    source_key text NOT NULL,
    required boolean NOT NULL,
    coverage text NOT NULL CHECK (coverage IN ('complete', 'partial', 'missing')),
    batch_id bigint,
    coverage_note text,
    CHECK ((coverage = 'missing') = (batch_id IS NULL)),
    CHECK (coverage = 'complete' OR NULLIF(btrim(coverage_note), '') IS NOT NULL),
    PRIMARY KEY (release_id, source_key),
    FOREIGN KEY (report_month, release_id)
        REFERENCES reporting.report_release (report_month, release_id),
    FOREIGN KEY (report_month, source_key, batch_id)
        REFERENCES reporting.import_batch (report_month, source_key, batch_id)
);

CREATE TABLE reporting.release_metric (
    release_id bigint NOT NULL REFERENCES reporting.report_release,
    metric_key text NOT NULL,
    scope_key text NOT NULL,
    unit text NOT NULL,
    coverage_start date NOT NULL,
    coverage_end date NOT NULL CHECK (coverage_end >= coverage_start),
    coverage text NOT NULL CHECK (coverage IN ('complete', 'partial', 'missing')),
    value numeric,
    numerator numeric,
    denominator numeric CHECK (denominator > 0),
    rule_version text NOT NULL,
    CHECK ((coverage = 'missing') = (value IS NULL)),
    PRIMARY KEY (release_id, metric_key, scope_key, coverage_start, coverage_end)
);

CREATE FUNCTION reporting.guard_finalized_batch() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, reporting AS $$
BEGIN
    IF OLD.status <> 'received' THEN
        RAISE EXCEPTION 'Batch % is finalized', OLD.batch_id;
    END IF;
    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    END IF;
    IF NEW.status = 'validated' AND EXISTS (
        SELECT 1 FROM reporting.import_issue
        WHERE batch_id = OLD.batch_id AND severity = 'blocking'
    ) THEN
        RAISE EXCEPTION 'Batch % has blocking issues', OLD.batch_id;
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER guard_finalized_batch BEFORE UPDATE OR DELETE ON reporting.import_batch
FOR EACH ROW EXECUTE FUNCTION reporting.guard_finalized_batch();

CREATE FUNCTION reporting.guard_import_issue() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, reporting AS $$
DECLARE
    target_id bigint;
    batch_status text;
BEGIN
    IF TG_OP = 'UPDATE' AND NEW.batch_id <> OLD.batch_id THEN
        RAISE EXCEPTION 'An issue cannot move to another batch';
    END IF;
    target_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.batch_id ELSE NEW.batch_id END;
    SELECT status INTO STRICT batch_status
    FROM reporting.import_batch WHERE batch_id = target_id FOR UPDATE;
    IF batch_status <> 'received' THEN
        RAISE EXCEPTION 'Batch % is finalized', target_id;
    END IF;
    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER guard_import_issue BEFORE INSERT OR UPDATE OR DELETE ON reporting.import_issue
FOR EACH ROW EXECUTE FUNCTION reporting.guard_import_issue();

CREATE FUNCTION reporting.guard_release_content() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, reporting AS $$
DECLARE
    target_id bigint;
    release_published_at timestamptz;
BEGIN
    IF TG_OP = 'UPDATE' AND NEW.release_id <> OLD.release_id THEN
        RAISE EXCEPTION 'An item cannot move to another release';
    END IF;
    target_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.release_id ELSE NEW.release_id END;
    SELECT published_at INTO STRICT release_published_at
    FROM reporting.report_release WHERE release_id = target_id FOR UPDATE;
    IF release_published_at IS NOT NULL THEN
        RAISE EXCEPTION 'Release % is already published', target_id;
    END IF;
    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER guard_release_source BEFORE INSERT OR UPDATE OR DELETE ON reporting.release_source
FOR EACH ROW EXECUTE FUNCTION reporting.guard_release_content();

CREATE TRIGGER guard_release_metric BEFORE INSERT OR UPDATE OR DELETE ON reporting.release_metric
FOR EACH ROW EXECUTE FUNCTION reporting.guard_release_content();

CREATE FUNCTION reporting.publish_release(target_id bigint, reviewer text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, reporting AS $$
DECLARE
    target reporting.report_release%ROWTYPE;
    active_revision integer;
BEGIN
    IF NULLIF(btrim(reviewer), '') IS NULL THEN
        RAISE EXCEPTION 'Reviewer is required';
    END IF;

    SELECT * INTO STRICT target FROM reporting.report_release WHERE release_id = target_id;
    PERFORM 1 FROM reporting.report_period WHERE report_month = target.report_month FOR UPDATE;
    SELECT * INTO STRICT target FROM reporting.report_release WHERE release_id = target_id FOR UPDATE;

    IF target.published_at IS NOT NULL THEN
        RAISE EXCEPTION 'Release % is already published', target_id;
    END IF;
    SELECT r.revision INTO active_revision
    FROM reporting.report_period p
    JOIN reporting.report_release r ON r.release_id = p.active_release_id
    WHERE p.report_month = target.report_month;

    IF target.revision <= active_revision THEN
        RAISE EXCEPTION 'Release % is older than the active revision', target_id;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM reporting.release_source
        WHERE release_id = target_id AND required
    ) OR EXISTS (
        SELECT 1 FROM reporting.release_source s
        LEFT JOIN reporting.import_batch b ON b.batch_id = s.batch_id
        WHERE s.release_id = target_id
          AND ((s.required AND s.coverage <> 'complete')
               OR (s.batch_id IS NOT NULL AND b.status <> 'validated'))
    ) THEN
        RAISE EXCEPTION 'Release % has incomplete required sources or unvalidated batches', target_id;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM reporting.release_metric
        WHERE release_id = target_id AND value IS NOT NULL
    ) THEN
        RAISE EXCEPTION 'Release % has no calculated metrics', target_id;
    END IF;

    UPDATE reporting.report_release
    SET published_at = clock_timestamp(), published_by = reviewer
    WHERE release_id = target_id;

    UPDATE reporting.report_period SET active_release_id = target_id
    WHERE report_month = target.report_month;
END;
$$;

REVOKE EXECUTE ON FUNCTION reporting.publish_release(bigint, text) FROM PUBLIC;

CREATE VIEW reporting.active_metrics AS
SELECT p.report_month, r.revision, r.published_at,
       m.metric_key, m.scope_key, m.unit, m.coverage_start, m.coverage_end,
       m.coverage, m.value, m.numerator, m.denominator, m.rule_version
FROM reporting.report_period p
JOIN reporting.report_release r ON r.release_id = p.active_release_id
JOIN reporting.release_metric m ON m.release_id = r.release_id;

COMMIT;
