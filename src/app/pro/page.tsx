import { redirect } from "next/navigation";

/** Legacy /pro URL — Creator Pro removed; send users to Go Live. */
export default function ProRedirectPage() {
  redirect("/go-live");
}
