"use client";

import Link from "next/link";
import { AdminAuthGate } from "../../../components/auth/admin-auth-gate";
import { Button } from "../../../components/ui/button";
import { useSupabaseAuth } from "../../../providers/supabase-provider";

export default function OnboardingPage() {
  const { signOut, user } = useSupabaseAuth();

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (error) {
      console.error("Failed to sign out", error);
    }
  };

  return (
    <AdminAuthGate>
      <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-50 px-6">
        <div className="w-full max-w-xl rounded-lg border border-dashed border-zinc-300 bg-white p-10 text-center shadow-sm">
          <span className="inline-flex items-center rounded-full bg-blue-100 px-3 py-1 text-xs font-medium text-blue-700">
            Welcome, {user?.email ?? "new admin"}
          </span>
          <h1 className="mt-4 text-2xl font-semibold text-zinc-900">Let&apos;s set up your organization</h1>
          <p className="mt-3 text-sm leading-6 text-zinc-600">
            Your Supabase account is connected, but you don&apos;t belong to an organization yet.
            Ask an existing owner to invite you or create a new workspace to start managing
            assessments.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link href="https://supabase.com/dashboard" target="_blank" className="w-full sm:w-auto">
              <Button variant="secondary" className="w-full justify-center">
                Review Supabase members
              </Button>
            </Link>
            <Link href="/app/dashboard" className="w-full sm:w-auto">
              <Button className="w-full justify-center" variant="default">
                I&apos;ve been invited
              </Button>
            </Link>
          </div>
          <div className="mt-6 text-xs text-zinc-500">
            Need help? Email <a href="mailto:admin@afterquery.com" className="text-blue-600">admin@afterquery.com</a> for onboarding support.
          </div>
          <Button onClick={handleSignOut} variant="link" className="mt-6 text-sm text-zinc-500">
            Sign out
          </Button>
        </div>
      </div>
    </AdminAuthGate>
  );
}
