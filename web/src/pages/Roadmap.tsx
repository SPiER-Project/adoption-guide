import { useMemo } from "react";
import { TOOLS, groupToolsByStage, type Tool } from "../data/catalog";
import roadmapSnapshot from "../data/roadmap.generated.json";

// ─────────────────────────────────────────────────────────────
// Roadmap data
// ------------------------------------------------------------
// Source of truth = GitHub Issues on the SPiER repo, snapshotted by
// `node web/scripts/fetch-roadmap.mjs` into roadmap.generated.json
// (committed so the build works offline).
//
// If a tool has no tracking epic in the snapshot, the page renders
// an "open tracking issue" CTA pointing at a pre-filled new-issue
// URL — see newIssueUrl() below.
// ─────────────────────────────────────────────────────────────

interface RoadmapIssue {
  number: number;
  title: string;
  state: "open" | "closed";
  url: string;
  bodyMd: string;
  labels: string[];
  createdAt: string;
  updatedAt: string;
  closedAt?: string;
  toolId?: string;
  priority?: "p1" | "p2" | "p3";
  status?: "built" | "planned" | "future";
  type?: "epic" | "task";
  stage?: string;
  area?: string;
}

interface RoadmapSnapshot {
  fetchedAt: string;
  repo: string;
  issues: RoadmapIssue[];
  error?: string;
}

const SNAPSHOT = roadmapSnapshot as RoadmapSnapshot;
const REPO_URL = `https://github.com/${SNAPSHOT.repo}`;

type ToolBuildStatus = "built" | "planned" | "future";

interface ToolRow {
  tool: Tool;
  status: ToolBuildStatus;
  epicIssue?: RoadmapIssue;
}

function buildToolRow(
  tool: Tool,
  issuesByToolId: Map<string, RoadmapIssue[]>,
): ToolRow {
  const issues = issuesByToolId.get(tool.id) ?? [];
  const epic = issues.find((i) => i.type === "epic") ?? issues[0];
  if (epic) {
    return {
      tool,
      epicIssue: epic,
      status: (epic.status ?? "planned") as ToolBuildStatus,
    };
  }
  // No tracking epic yet — page renders an "open tracking issue" CTA via newIssueUrl.
  // launch-action heuristic gives a best-guess status until the epic exists.
  return {
    tool,
    status: tool.launchActions.length > 0 ? "built" : "planned",
  };
}

function newIssueUrl(tool: Tool): string {
  const params = new URLSearchParams({
    title: `[${tool.id}] ${tool.shortName ?? tool.name}`,
    labels: `type:epic,tool:${tool.id},stage:${tool.stageId}`,
    body: `Tracking epic for **${tool.name}**.\n\n## Next\n\n(describe the next step here)\n`,
  });
  return `${REPO_URL}/issues/new?${params.toString()}`;
}

export function Roadmap() {
  const {
    groupedRows,
    builtCount,
    plannedCount,
    futureCount,
    priorityEpics,
    doneIssues,
  } = useMemo(() => {
    // Index issues by tool ID for O(1) lookup.
    const byTool = new Map<string, RoadmapIssue[]>();
    for (const issue of SNAPSHOT.issues) {
      if (!issue.toolId) continue;
      const list = byTool.get(issue.toolId) ?? [];
      list.push(issue);
      byTool.set(issue.toolId, list);
    }

    const rows: ToolRow[] = [];
    const rowById = new Map<string, ToolRow>();
    for (const t of TOOLS) {
      const r = buildToolRow(t, byTool);
      rows.push(r);
      rowById.set(t.id, r);
    }
    const grouped = groupToolsByStage().map(({ stage, tools }) => ({
      stage,
      rows: tools
        .map((t) => rowById.get(t.id))
        .filter((r): r is ToolRow => !!r),
    }));

    const counts = rows.reduce(
      (acc, r) => {
        acc[r.status] += 1;
        return acc;
      },
      { built: 0, planned: 0, future: 0 } as Record<ToolBuildStatus, number>,
    );

    const priority = SNAPSHOT.issues.filter(
      (i) => i.priority && i.type === "epic",
    );
    const done = SNAPSHOT.issues
      .filter((i) => i.state === "closed" && i.closedAt)
      .sort((a, b) => (b.closedAt ?? "").localeCompare(a.closedAt ?? ""))
      .slice(0, 10);

    return {
      groupedRows: grouped,
      builtCount: counts.built,
      plannedCount: counts.planned,
      futureCount: counts.future,
      priorityEpics: priority,
      doneIssues: done,
    };
  }, []);

  const seedRequired = SNAPSHOT.issues.length === 0;
  const epicByPriority = (key: "p1" | "p2" | "p3") =>
    priorityEpics.find((i) => i.priority === key);

  return (
    <div className="page-placeholder">
      <p>
        Three strategic priorities, taken in order. Each one is a precondition
        for the next: you can't put codes on tools that aren't structured, and
        you can't wire automations between tools whose data elements aren't
        standardized.
      </p>
      <p className="roadmap-source-note">
        Tracking lives in{" "}
        <a href={`${REPO_URL}/issues`} target="_blank" rel="noreferrer">
          {SNAPSHOT.repo} issues
        </a>
        {seedRequired ? (
          <>
            {" "}
            — snapshot is empty. Run{" "}
            <code>node scripts/seed-roadmap-issues.mjs</code> then{" "}
            <code>node web/scripts/fetch-roadmap.mjs</code> to populate.
          </>
        ) : (
          <>
            {" "}
            — snapshot from{" "}
            <time dateTime={SNAPSHOT.fetchedAt}>
              {new Date(SNAPSHOT.fetchedAt).toLocaleString()}
            </time>
            . Refresh with <code>node web/scripts/fetch-roadmap.mjs</code>.
          </>
        )}
      </p>

      <section className="roadmap-section">
        <h3>Priority 1 &middot; Translate tools to FHIR objects</h3>
        <p>
          Today the catalog (<code>Tool</code>, <code>Stage</code>,{" "}
          <code>Trigger</code>, <code>Preset</code>) lives as bespoke TypeScript
          interfaces. To be a real reference implementation rather than just a
          demo, the catalog needs to be FHIR-shaped:
        </p>
        <ul>
          <li>
            <code>Tool</code> &rarr; <strong>ActivityDefinition</strong>{" "}
            (referencing the Questionnaire)
          </li>
          <li>
            <code>Stage</code> + pathway &rarr; <strong>PlanDefinition</strong>{" "}
            with grouped actions
          </li>
          <li>
            <code>Trigger</code> &rarr;{" "}
            <strong>PlanDefinition.action.trigger</strong> (TriggerDefinition)
          </li>
          <li>
            <code>Preset</code> / user tool-config &rarr; a custom{" "}
            <strong>PlanDefinition</strong> that selects a subset of the
            canonical pathway's actions
          </li>
          <li>
            <strong>Licensing &amp; usage requirements per tool</strong> &mdash;
            capture each instrument's licensing status using{" "}
            <code>ActivityDefinition.copyright</code>,{" "}
            <code>copyrightLabel</code>, and related fields. Public domain (ASQ,
            PHQ-9, SBQ-R, BSSA) vs registration-required (C-SSRS) vs
            commercially licensed (CAMS) all need to surface in the
            Implementation Guide so adopters know what's actually safe to deploy
            and where attribution or fees are required.
          </li>
        </ul>
        <p>
          The payoff: a configured implementation can be exported as a FHIR
          Bundle and handed to another EHR. SPiER stops modeling interop and
          starts demonstrating it.
        </p>
        <PriorityEpicLink epic={epicByPriority("p1")} />
      </section>

      <section className="roadmap-section">
        <h3>Priority 2 &middot; Use LOINC / SNOMED codes where available</h3>
        <p>
          Once tools are FHIR shapes, every coded element should reference a
          standard terminology rather than a local string:
        </p>
        <ul>
          <li>
            Questionnaire item codes &rarr; LOINC where published (e.g. PHQ-9
            individual items, ASQ result, C-SSRS items)
          </li>
          <li>
            Observation codes &rarr; LOINC for survey results, vitals-style
            measures (CAMS SSF psychological pain, etc.)
          </li>
          <li>
            Condition / Problem codes &rarr; SNOMED CT (suicidal ideation,
            suicide attempt, self-harm, depression)
          </li>
          <li>
            Procedure / intervention codes &rarr; SNOMED or CPT (safety
            planning, means counseling, follow-up)
          </li>
        </ul>
        <p>
          Where no published LOINC exists (e.g. CAMS SSF measures), document the
          local code system clearly so a receiving system knows what to map.
        </p>
        <PriorityEpicLink epic={epicByPriority("p2")} />
      </section>

      <section className="roadmap-section">
        <h3>
          Priority 3 &middot; Automations &amp; clinical decision support hooks
        </h3>
        <p>
          With structured, coded tools in place, the workflow logic between
          stages becomes machine-readable:
        </p>
        <ul>
          <li>
            <strong>Triggers between stages</strong> &mdash; e.g. PHQ-9 Item 9
            &ge; 1 fires the Flag Risk &rarr; Clarify Risk transition, modeled
            as <code>PlanDefinition.action.trigger</code>.
          </li>
          <li>
            <strong>CDS Hooks integration</strong> &mdash; expose risk-elevating
            events (<code>patient-view</code>, <code>order-sign</code>) so an
            EHR can call out to a SPiER service and receive cards recommending
            the next stage's tool.
          </li>
          <li>
            <strong>Care-plan auto-generation</strong> &mdash; completion of a
            Stabilization or Stanley-Brown questionnaire writes a derived{" "}
            <code>CarePlan</code> resource automatically (already partially
            implemented; formalize as a defined transformation).
          </li>
        </ul>
        <PriorityEpicLink epic={epicByPriority("p3")} />
      </section>

      <section className="roadmap-section">
        <h3>Tool build status</h3>
        <p>
          Every tool catalogued on the Pathway page is listed here with its
          current build state and a link to its tracking epic.{" "}
          <strong>{builtCount}</strong> built, <strong>{plannedCount}</strong>{" "}
          planned, <strong>{futureCount}</strong> future, of{" "}
          <strong>{TOOLS.length}</strong> total.
        </p>
        {groupedRows.map(({ stage, rows }) => (
          <div key={stage.id} className="roadmap-stage-block">
            <h4 className="roadmap-stage-heading">{stage.title}</h4>
            {rows.length === 0 && (
              <p className="roadmap-tool-empty">
                No tools catalogued for this stage yet. Likely candidates:
                outcome reporting packs, registry exports, and de-identified
                pathway-completion measures.
              </p>
            )}
            <ul className="roadmap-tool-list">
              {rows.map((row) => (
                <li
                  key={row.tool.id}
                  className={`roadmap-tool roadmap-tool--${row.status}`}
                >
                  <span
                    className={`roadmap-tool-status roadmap-tool-status--${row.status}`}
                  >
                    {row.status}
                  </span>
                  <div className="roadmap-tool-body">
                    <div className="roadmap-tool-name">
                      <strong>{row.tool.shortName ?? row.tool.name}</strong>
                      <span className="roadmap-tool-id">{row.tool.id}</span>
                      <span
                        className={`roadmap-tool-inclusion roadmap-tool-inclusion--${row.tool.inclusionStatus}`}
                      >
                        {row.tool.inclusionStatus}
                      </span>
                      {row.epicIssue ? (
                        <a
                          className="roadmap-tool-issue-link"
                          href={row.epicIssue.url}
                          target="_blank"
                          rel="noreferrer"
                        >
                          #{row.epicIssue.number}
                        </a>
                      ) : (
                        <a
                          className="roadmap-tool-issue-link roadmap-tool-issue-link--missing"
                          href={newIssueUrl(row.tool)}
                          target="_blank"
                          rel="noreferrer"
                        >
                          open tracking issue
                        </a>
                      )}
                    </div>
                    <div className="roadmap-tool-plan">
                      {row.epicIssue
                        ? excerpt(row.epicIssue.bodyMd)
                        : "Not yet scoped — open a tracking issue."}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </section>

      {doneIssues.length > 0 && (
        <section className="roadmap-section">
          <h3>Recently completed</h3>
          <ul>
            {doneIssues.map((i) => (
              <li key={i.number}>
                <a href={i.url} target="_blank" rel="noreferrer">
                  #{i.number} {i.title}
                </a>
                {i.closedAt && (
                  <span className="roadmap-tool-id">
                    {" "}
                    — {new Date(i.closedAt).toLocaleDateString()}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="roadmap-section">
        <h3>Foundational milestones</h3>
        <p>
          The cross-cutting work that brought SPiER to its current state. Future
          milestones live in the issue tracker.
        </p>
        <ul>
          <li>
            FHIR Questionnaires for ASQ, PHQ-9, C-SSRS, SBQ-R, CAMS (Sections
            A/B, Stabilization, Therapeutic Worksheet), Stanley-Brown
          </li>
          <li>
            Unified Implementation Guide (Pathway, Data Dictionary, Adoption
            Rubric, Tool Configuration, Roadmap)
          </li>
          <li>
            8-stage pathway hierarchy with FHIR resources organized by stage
          </li>
          <li>
            Three-lens navigation (Home, Implementation Guide, Patient View,
            Population View)
          </li>
          <li>
            Tool Configuration: implementation-level feature flags driving the
            Patient View's Assessments tab (localStorage-backed)
          </li>
          <li>
            Consolidated single-page Patient Chart (risk status, care plans,
            encounters timeline with anchor links)
          </li>
          <li>
            Design-token system: centralized colors, spacing, and radii under{" "}
            <code>:root</code> in <code>index.css</code>
          </li>
        </ul>
      </section>
    </div>
  );
}

function PriorityEpicLink({ epic }: { epic?: RoadmapIssue }) {
  if (!epic) return null;
  return (
    <p className="roadmap-priority-link">
      Tracking:{" "}
      <a href={epic.url} target="_blank" rel="noreferrer">
        #{epic.number} {epic.title}
      </a>
    </p>
  );
}

// Show the first ~280 chars of the issue body so the page stays scannable.
// The full body is one click away via the issue link.
function excerpt(md: string, max = 280): string {
  if (!md) return "No description.";
  const stripped = md
    .replace(/^#{1,6}\s+/gm, "") // headings
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1") // links → link text
    .replace(/^-{3,}$/gm, "") // horizontal rules
    .replace(/[`*_>]/g, "") // markdown noise (incl. backticks)
    .replace(/\s+/g, " ")
    .trim();
  if (stripped.length <= max) return stripped;
  return stripped.slice(0, max).replace(/\s\S*$/, "") + "…";
}
