import { redirect } from "next/navigation";
import Dashboard from "@/components/Dashboard";
import Shell from "@/components/Shell";
import { isAuthed } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function Home() {
  if (!(await isAuthed())) redirect("/login");
  return <Shell dashboard={<Dashboard />} />;
}
