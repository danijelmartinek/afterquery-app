import { redirect } from "next/navigation";

export default function AdminIndexPage() {
  redirect("/app/dashboard");
}
