/**
 * Orchestrates a connector pull → auto-mapped evidence write. Each entry
 * in PIPELINES owns one (provider, kind) pair: it fetches the upstream
 * data, opens a connector_runs row, hashes the canonical bytes, and
 * hands them to recordConnectorEvidence().
 *
 * Failures are isolated per-pipeline: one kind erroring does not block
 * the others. The result is a per-kind status array suitable for both
 * cron logging and live UI feedback ("MFA: pulled 27 users; Patch: not
 * implemented").
 */

import {
  ARTIFACT_KIND_REGISTRY,
  type ArtifactKind,
  type ConnectorProviderTag,
  canonicalJsonBytes,
  completeConnectorRun,
  recordConnectorEvidence,
  startConnectorRun,
} from "./auto-map";
import {
  fetchAuthorizedUsers,
  fetchMfaReport,
} from "./m365-graph";

export type SyncOutcome = {
  provider: ConnectorProviderTag;
  kind: ArtifactKind;
  status: "ok" | "skipped" | "failed";
  rowCount?: number;
  artifactId?: string;
  dataHash?: string;
  message?: string;
};

type Pipeline = {
  provider: ConnectorProviderTag;
  kind: ArtifactKind;
  /**
   * Returns canonical bytes + row count, or null to skip (e.g. provider
   * is not connected). Throw to mark as failed.
   */
  fetch: (
    organizationId: string,
  ) => Promise<{ bytes: Buffer; rowCount: number; syncedAt: Date } | null>;
};

const PIPELINES: ReadonlyArray<Pipeline> = [
  {
    provider: "m365",
    kind: "authorized_users_roster",
    async fetch(organizationId) {
      const data = await fetchAuthorizedUsers(organizationId);
      if (!data) return null;
      return {
        bytes: canonicalJsonBytes(data),
        rowCount: data.users.length,
        syncedAt: new Date(data.pulledAt),
      };
    },
  },
  {
    provider: "m365",
    kind: "mfa_report",
    async fetch(organizationId) {
      const data = await fetchMfaReport(organizationId);
      if (!data) return null;
      return {
        bytes: canonicalJsonBytes(data),
        rowCount: data.users.length,
        syncedAt: new Date(data.pulledAt),
      };
    },
  },
  // Future pipelines:
  //   - m365 / external_sharing_audit (SharePoint Sites.Read.All)
  //   - m365 / public_facing_shares  (SharePoint anonymous-link query)
  //   - intune / patch_compliance    (DeviceManagementManagedDevices.Read.All)
  //   - intune / defender_av_inventory (Defender Reports.Read.All)
  // For now those kinds are reachable via /api/connectors/ingest
  // (manual JSON/CSV upload) which still gets the same auto-mapping
  // and provenance hash.
];

export async function runConnectorSync(args: {
  organizationId: string;
  assessmentId: string;
  triggeredBy?: "scheduler" | "manual" | "webhook";
  /** Restrict the sync to specific (provider, kind) pairs. */
  only?: ReadonlyArray<{ provider: ConnectorProviderTag; kind: ArtifactKind }>;
}): Promise<SyncOutcome[]> {
  const outcomes: SyncOutcome[] = [];
  const pipelines = args.only
    ? PIPELINES.filter((p) =>
        args.only!.some((o) => o.provider === p.provider && o.kind === p.kind),
      )
    : PIPELINES;

  for (const pipeline of pipelines) {
    const runId = await startConnectorRun({
      organizationId: args.organizationId,
      provider: pipeline.provider,
      kind: pipeline.kind,
      triggeredBy: args.triggeredBy,
    });
    try {
      const fetched = await pipeline.fetch(args.organizationId);
      if (!fetched) {
        await completeConnectorRun({
          runId,
          status: "failed",
          error: "provider not connected (no token)",
        });
        outcomes.push({
          provider: pipeline.provider,
          kind: pipeline.kind,
          status: "skipped",
          message: "Provider not connected",
        });
        continue;
      }
      const result = await recordConnectorEvidence({
        organizationId: args.organizationId,
        assessmentId: args.assessmentId,
        provider: pipeline.provider,
        kind: pipeline.kind,
        payloadBytes: fetched.bytes,
        syncedAt: fetched.syncedAt,
        runId,
        rowCount: fetched.rowCount,
        contentType: ARTIFACT_KIND_REGISTRY[pipeline.kind].contentType,
      });
      await completeConnectorRun({
        runId,
        status: "success",
        rowCount: fetched.rowCount,
        rawHash: result.dataHash,
      });
      outcomes.push({
        provider: pipeline.provider,
        kind: pipeline.kind,
        status: "ok",
        rowCount: fetched.rowCount,
        artifactId: result.artifactId,
        dataHash: result.dataHash,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await completeConnectorRun({ runId, status: "failed", error: message });
      outcomes.push({
        provider: pipeline.provider,
        kind: pipeline.kind,
        status: "failed",
        message,
      });
    }
  }
  return outcomes;
}

export function listSupportedPipelines(): ReadonlyArray<{
  provider: ConnectorProviderTag;
  kind: ArtifactKind;
}> {
  return PIPELINES.map((p) => ({ provider: p.provider, kind: p.kind }));
}
