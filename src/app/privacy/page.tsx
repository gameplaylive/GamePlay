import { redirect } from "next/navigation";

/** Canonical AdSense/legal URL is /privacy-policy */
export default function PrivacyRedirectPage() {
  redirect("/privacy-policy");
}
