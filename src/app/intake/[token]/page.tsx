import type { Metadata } from "next";
import { getIntakeInvitationByToken } from "@/lib/intake-invitations";
import { IntakeChat } from "./IntakeChat";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Custodia — client intake",
  robots: { index: false, follow: false },
};

export default async function IntakePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const invite = await getIntakeInvitationByToken(token);
  if (!invite) {
    return (
      <main className="min-h-screen bg-[#f5f1e8] px-6 py-16">
        <div className="mx-auto max-w-xl rounded-md border border-[#cfe3d9] bg-white p-8 shadow-sm">
          <h1 className="font-serif text-2xl font-bold text-[#0e2a23]">
            This intake link isn&apos;t active.
          </h1>
          <p className="mt-3 text-sm text-[#3a5a4f]">
            Either it expired, was revoked, or the URL was mistyped. Please ask
            the person who sent it to issue a new one.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f5f1e8]">
      <div className="mx-auto flex min-h-screen w-full max-w-3xl flex-col gap-4 px-4 py-6">
        <header className="flex flex-col gap-1">
          <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#5a7d70]">
            Client intake portal
          </span>
          <h1 className="font-serif text-2xl font-bold text-[#10231d]">
            {invite.client_name
              ? `Hi ${invite.client_name.split(" ")[0]} —`
              : "Welcome —"}{" "}
            let&apos;s capture what your business does.
          </h1>
          <p className="text-sm text-[#3a5a4f]">
            Charlie, your virtual compliance officer, will ask a series of
            short questions. There is no right or wrong answer. You can close
            this tab and come back any time before{" "}
            {new Date(invite.expires_at).toLocaleDateString(undefined, {
              month: "long",
              day: "numeric",
            })}
            .
          </p>
        </header>
        <div className="flex min-h-0 flex-1 flex-col">
          <IntakeChat token={token} />
        </div>
      </div>
    </main>
  );
}
