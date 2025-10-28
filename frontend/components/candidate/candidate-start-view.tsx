"use client";

import ReactMarkdown from "react-markdown";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import {
  startCandidateAssessment,
  submitCandidateAssessment,
} from "../../lib/api";
import type {
  CandidateRepo,
  CandidateStartAssessment,
  CandidateStartInvitation,
  CandidateStartSeed,
} from "../../lib/types";

type CandidateStartViewProps = {
  invitation: CandidateStartInvitation;
  assessment: CandidateStartAssessment;
  seed: CandidateStartSeed;
  repo?: CandidateRepo;
  startToken: string;
};

export function CandidateStartView({ invitation, assessment, seed, repo, startToken }: CandidateStartViewProps) {
  const router = useRouter();
  const [currentInvitation, setCurrentInvitation] = useState(invitation);
  const [currentRepo, setCurrentRepo] = useState<CandidateRepo | undefined>(repo);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [activeAction, setActiveAction] = useState<"start" | "finish" | null>(null);
  const [isRefreshing, startRefresh] = useTransition();
  const [accessTokenInfo, setAccessTokenInfo] = useState<
    { token: string; expiresAt: string } | null
  >(null);

  const formatDate = (value: string | null) => {
    if (!value) {
      return null;
    }
    return new Date(value).toLocaleString();
  };

  const refreshPage = () => {
    startRefresh(() => {
      router.refresh();
    });
  };

  const handleStart = async () => {
    setActiveAction("start");
    setActionError(null);
    setActionMessage(null);
    try {
      const result = await startCandidateAssessment(startToken);
      setCurrentInvitation((prev) => ({
        ...prev,
        status: result.status,
        startedAt: result.startedAt,
        completeDeadline: result.completeDeadline,
      }));
      setCurrentRepo(result.candidateRepo);
      setAccessTokenInfo({
        token: result.accessToken,
        expiresAt: result.accessTokenExpiresAt,
      });
      setActionMessage(
        `You're marked as started. Your private repo is ${result.candidateRepo.repoFullName}.`,
      );
      refreshPage();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Unable to mark as started.");
    } finally {
      setActiveAction(null);
    }
  };

  const handleFinish = async () => {
    setActiveAction("finish");
    setActionError(null);
    setActionMessage(null);
    try {
      const result = await submitCandidateAssessment(startToken);
      setCurrentInvitation((prev) => ({
        ...prev,
        status: result.status,
        submittedAt: result.submittedAt,
      }));
      setAccessTokenInfo(null);
      setActionMessage("Thanks! We've marked your assessment as submitted.");
      refreshPage();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Unable to mark as finished.");
    } finally {
      setActiveAction(null);
    }
  };

  const hasStarted =
    currentInvitation.status === "started" || currentInvitation.status === "submitted";
  const canFinish = currentInvitation.status === "started";
  const isSubmitted = currentInvitation.status === "submitted";

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-zinc-50 px-6 py-10">
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="space-y-2 text-center">
          <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-blue-700">
            Afterquery Assessment
          </span>
          <h1 className="text-3xl font-semibold text-zinc-900">{assessment.title}</h1>
          <p className="text-sm text-zinc-600">Invited for {currentInvitation.candidateName}</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Start your private repo</CardTitle>
            <CardDescription>
              Repos are generated from the
              {" "}
              <a
                href={seed.seedRepoUrl}
                target="_blank"
                rel="noreferrer"
                className="font-medium text-blue-600 hover:underline"
              >
                {seed.seedRepo}
              </a>
              {seed.latestMainSha ? ` at SHA ${seed.latestMainSha}.` : "."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-zinc-600">
            <div className="flex items-center justify-between rounded-lg border border-zinc-200 bg-white p-4">
              <div>
                <p className="text-xs uppercase tracking-wide text-zinc-400">Start by</p>
                <p className="text-base font-semibold text-zinc-900">
                  {formatDate(currentInvitation.startDeadline) ?? "Schedule coming soon"}
                </p>
              </div>
              <Badge>
                {currentInvitation.completeDeadline
                  ? `Complete by ${formatDate(currentInvitation.completeDeadline)}`
                  : `Complete within ${assessment.timeToCompleteHours}h`}
              </Badge>
            </div>
            <div>
              <p className="font-semibold text-zinc-800">1. Authenticate Git</p>
              {accessTokenInfo ? (
                <>
                  <code className="mt-2 block rounded-md bg-zinc-900 p-4 font-mono text-xs text-zinc-100">
                    export GITHUB_TOKEN={accessTokenInfo.token}
                  </code>
                  <p className="mt-2 text-xs text-zinc-500">
                    Token expires {new Date(accessTokenInfo.expiresAt).toLocaleString()}. Run commands in the same shell so Git uses the token as your HTTPS password.
                  </p>
                </>
              ) : (
                <p className="mt-2 text-xs text-zinc-500">
                  Click <strong>Start assessment</strong> to mint your private repository and GitHub App token.
                </p>
              )}
            </div>
            <div>
              <p className="font-semibold text-zinc-800">2. Clone the repo</p>
              <code className="mt-2 block rounded-md bg-zinc-900 p-4 font-mono text-xs text-zinc-100">
                {currentRepo
                  ? `git clone https://github.com/${currentRepo.repoFullName}.git`
                  : "git clone https://github.com/<org>/<assessment-repo>.git"}
              </code>
              <p className="mt-2 text-xs text-zinc-500">
                Use the token above as the HTTPS password when prompted. You can also store it in a credential helper.
              </p>
            </div>
            <div>
              <p className="font-semibold text-zinc-800">3. Submit</p>
              <p className="mt-1 text-xs text-zinc-500">
                Push your final commits to <span className="font-mono">main</span> before the completion window expires. We'll email confirmation immediately.
              </p>
            </div>
            {currentRepo && (
              <div className="rounded-lg border border-dashed border-blue-200 bg-blue-50 p-4 text-xs text-blue-700">
                Repo provisioned at <strong>{currentRepo.repoFullName}</strong>. Resume work from your local
                clone. Need a fresh token? Click <strong>Start assessment</strong> again to reissue one instantly.
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Instructions</CardTitle>
            <CardDescription>
              Follow these steps carefully. We'll discuss trade-offs during your review conversation.
            </CardDescription>
          </CardHeader>
          <CardContent className="prose prose-zinc max-w-none">
            <ReactMarkdown>{assessment.instructions ?? ""}</ReactMarkdown>
          </CardContent>
        </Card>

        <div className="space-y-2">
          {actionError && <p className="text-sm text-red-600">{actionError}</p>}
          {actionMessage && <p className="text-sm text-green-700">{actionMessage}</p>}
          {isSubmitted && currentInvitation.submittedAt && (
            <p className="text-sm text-green-700">
              Assessment submitted on {formatDate(currentInvitation.submittedAt)}. We'll be in touch soon.
            </p>
          )}
          <div className="flex flex-wrap items-center justify-end gap-3">
            {!hasStarted && (
              <Button
                size="lg"
                onClick={handleStart}
                disabled={activeAction !== null || isRefreshing}
              >
                {activeAction === "start" ? "Marking..." : "Mark as started"}
              </Button>
            )}
            {canFinish && (
              <Button
                size="lg"
                variant="outline"
                onClick={handleFinish}
                disabled={activeAction !== null || isRefreshing}
              >
                {activeAction === "finish" ? "Submitting..." : "Mark as finished"}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
