import Link from "next/link";
import { Button } from "../../../components/ui/button";

export default function LoginPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-blue-50 to-zinc-50 px-6">
      <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-8 shadow-lg">
        <div>
          <p className="text-xs uppercase tracking-wide text-blue-600">Afterquery</p>
          <h1 className="mt-2 text-2xl font-semibold text-zinc-900">Sign in to continue</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Admin access uses Supabase magic links. Enter your email to receive a login link.
          </p>
        </div>
        <form className="mt-6 space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-zinc-700" htmlFor="email">
              Work email
            </label>
            <input
              id="email"
              type="email"
              required
              placeholder="alex@afterquery.com"
              className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-200"
            />
          </div>
          <Button className="w-full" type="submit">
            Send magic link
          </Button>
        </form>
        <p className="mt-6 text-center text-xs text-zinc-500">
          Need an account? <Link href="/" className="text-blue-600">Contact the platform admin.</Link>
        </p>
      </div>
    </div>
  );
}
