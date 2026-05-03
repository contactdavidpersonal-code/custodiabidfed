/**
 * ConnectorHint — inline banner shown next to evidence sections that
 * could be auto-pulled from a connected provider. Three states:
 *  - Connector covers this control AND user has it connected: success note.
 *  - Connector covers this control AND user has NOT connected: nudge to connect.
 *  - No connector covers this control: render nothing.
 */

import Link from "next/link";
import { CONNECTORS } from "@/lib/connectors/registry";
import { getConnectorTokenStatus } from "@/lib/connectors/storage";
import type { ConnectorProvider } from "@/lib/connectors/types";

type Props = {
  controlId: string;
  organizationId: string;
};

const PROVIDER_LABEL: Record<ConnectorProvider, string> = {
  m365: "Microsoft 365",
  google_workspace: "Google Workspace",
};

export async function ConnectorHint({ controlId, organizationId }: Props) {
  const eligible = (Object.values(CONNECTORS) as Array<
    (typeof CONNECTORS)[keyof typeof CONNECTORS]
  >).filter((c) => c.controlsCovered.includes(controlId));

  if (eligible.length === 0) return null;

  const tokens = await getConnectorTokenStatus(organizationId);
  const connected = new Set(
    tokens.filter((t) => !t.revoked_at).map((t) => t.provider),
  );

  const matched = eligible.find((c) => connected.has(c.provider));

  if (matched) {
    return (
      <div className="mb-4 flex flex-wrap items-center gap-2  border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
        <span className="font-bold">✓ Auto-collectable.</span>
        <span>
          Charlie can pull this evidence directly from your connected{" "}
          <strong>{PROVIDER_LABEL[matched.provider]}</strong> tenant — no manual
          screenshot required.
        </span>
        <Link
          href="/assessments/connections"
          className="ml-auto whitespace-nowrap text-xs font-semibold underline decoration-emerald-700 underline-offset-2 hover:text-emerald-700"
        >
          Manage connections →
        </Link>
      </div>
    );
  }

  const labels = eligible.map((c) => PROVIDER_LABEL[c.provider]).join(" or ");
  return (
    <div className="mb-4 flex flex-wrap items-center gap-2  border border-[#cfe3d9] bg-[#f1f6f3] px-4 py-3 text-sm text-[#10231d]">
      <span aria-hidden className="text-base leading-none">💡</span>
      <span>
        <strong>Skip the screenshot.</strong> Connect <strong>{labels}</strong> and
        Charlie auto-collects this evidence.
      </span>
      <Link
        href="/assessments/connections"
        className="ml-auto whitespace-nowrap  bg-[#10231d] px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-[#0a1814]"
      >
        Connect →
      </Link>
    </div>
  );
}
