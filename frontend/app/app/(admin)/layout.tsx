import { AdminDataProvider } from "../../../providers/admin-data-provider";
import { AppShell } from "../../../components/layout/app-shell";

export default function AdminAppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AdminDataProvider>
      <AppShell>{children}</AppShell>
    </AdminDataProvider>
  );
}
