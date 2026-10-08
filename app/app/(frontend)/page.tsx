import { redirect } from "next/navigation";

// The site has a single public section for now, so the root goes straight to
// it. A temporary redirect: the root is expected to get its own page again.
export default function Home() {
  redirect("/disciplinas");
}
