"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { completeGitHubInstallation } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useAdminData } from "@/providers/admin-data-provider";
import { useSupabaseAuth } from "@/providers/supabase-provider";

export default function GitHubInstallCallbackPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { dispatch } = useAdminData();
  const { accessToken, loading: authLoading } = useSupabaseAuth();

  const [status, setStatus] = useState<"pending" | "success" | "error">("pending");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [destinationPath, setDestinationPath] = useState<string>("/app/dashboard");

  const setupAction = useMemo(() => searchParams.get("setup_action") ?? "install", [searchParams]);

  useEffect(() => {
    if (authLoading) {
      return;
    }

    const stateParam = searchParams.get("state");
    const installationIdParam = searchParams.get("installation_id");
    if (!stateParam || !installationIdParam) {
      setStatus("error");
      setErrorMessage("Missing installation parameters from GitHub.");
      return;
    }

    const installationId = Number(installationIdParam);
    if (!Number.isFinite(installationId)) {
      setStatus("error");
      setErrorMessage("GitHub returned an invalid installation id.");
      return;
    }

    if (!accessToken) {
      setStatus("error");
      setErrorMessage("Sign in to finalize the GitHub App connection.");
      return;
    }

    let active = true;
    setStatus("pending");
    setErrorMessage(null);

    completeGitHubInstallation(stateParam, installationId, { accessToken })
      .then(({ installation, returnPath }) => {
        if (!active) return;
        dispatch({ type: "setGitHubInstallation", payload: installation });
        setStatus("success");
        const target =
          returnPath && returnPath.startsWith("/") ? returnPath : "/app/dashboard";
        setDestinationPath(target);
        setTimeout(() => {
          router.replace(target);
        }, 1500);
      })
      .catch((error) => {
        if (!active) return;
        const message = error instanceof Error ? error.message : "Failed to finalize the GitHub connection.";
        setErrorMessage(message);
        setStatus("error");
      });

    return () => {
      active = false;
    };
  }, [accessToken, authLoading, dispatch, router, searchParams]);

  const description = useMemo(() => {
    if (status === "success") {
      return "GitHub App connected. Redirecting you back to where you started.";
    }
    if (status === "error") {
      return errorMessage ?? "Something went wrong while connecting the GitHub App.";
    }
    return setupAction === "update"
      ? "Updating permissions for your GitHub App installation."
      : "Finishing the GitHub App installation for your project.";
  }, [errorMessage, setupAction, status]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center p-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>GitHub App connection</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {status === "pending" ? (
            <p className="text-sm text-zinc-600">We’re confirming your installation with GitHub…</p>
          ) : null}
          {status === "success" ? (
            <p className="text-sm text-green-600">Success! You’ll be redirected shortly.</p>
          ) : null}
          {status === "error" && errorMessage ? (
            <p className="text-sm text-red-600">{errorMessage}</p>
          ) : null}
        </CardContent>
        <CardFooter className="flex justify-end gap-3">
          <Button variant="outline" onClick={() => router.replace(destinationPath)}>Return to workspace</Button>
          {status === "error" ? (
            <Button onClick={() => router.replace(destinationPath)}>Try again</Button>
          ) : null}
        </CardFooter>
      </Card>
    </div>
  );
}
