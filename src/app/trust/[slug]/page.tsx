import { permanentRedirect } from "next/navigation";

/**
 * Legacy /trust/[slug] route — permanently redirects to /verified/[slug].
 */
export default async function LegacyTrustRedirect(
  props: PageProps<"/trust/[slug]">,
) {
  const { slug } = await props.params;
  permanentRedirect(`/verified/${slug}`);
}
