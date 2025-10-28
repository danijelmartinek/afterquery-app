"use client";

import ReactMarkdown from "react-markdown";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import type { Assessment, CandidateRepo, Invitation, Seed } from "../../lib/types";

type CandidateStartViewProps = {
  invitation: Invitation;
  assessment: Assessment;
  seed: Seed;
  repo?: CandidateRepo;
  startToken: string;
};

export function CandidateStartView({ invitation, assessment, seed, repo, startToken }: CandidateStartViewProps) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-zinc-50 px-6 py-10">
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="space-y-2 text-center">
          <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-blue-700">
            Afterquery Assessment
          </span>
          <h1 className="text-3xl font-semibold text-zinc-900">{assessment.title}</h1>
          <p className="text-sm text-zinc-600">Invited for {invitation.candidateName}</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Start your private repo</CardTitle>
            <CardDescription>
              Repos are generated from the {seed.seedRepo} template at SHA {seed.latestMainSha}.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-zinc-600">
            <div className="flex items-center justify-between rounded-lg border border-zinc-200 bg-white p-4">
              <div>
                <p className="text-xs uppercase tracking-wide text-zinc-400">Start by</p>
                <p className="text-base font-semibold text-zinc-900">
                  {invitation.startDeadline
                    ? new Date(invitation.startDeadline).toLocaleString()
                    : "Schedule coming soon"}
                </p>
              </div>
              <Badge>Complete within {assessment.timeToCompleteHours}h</Badge>
            </div>
            <div>
              <p className="font-semibold text-zinc-800">1. Authenticate Git</p>
              <code className="mt-2 block rounded-md bg-zinc-900 p-4 font-mono text-xs text-zinc-100">
                git credential fill | curl -s https://app.afterquery.dev/git/credential?token={startToken}
              </code>
              <p className="mt-2 text-xs text-zinc-500">
                This helper exchanges your invite token for a temporary GitHub App token. Keep the terminal open to refresh as needed.
              </p>
            </div>
            <div>
              <p className="font-semibold text-zinc-800">2. Clone the repo</p>
              <code className="mt-2 block rounded-md bg-zinc-900 p-4 font-mono text-xs text-zinc-100">
                git clone https://git.afterquery.dev/r/{assessment.id}.git
              </code>
            </div>
            <div>
              <p className="font-semibold text-zinc-800">3. Submit</p>
              <p className="mt-1 text-xs text-zinc-500">
                Push your final commits to <span className="font-mono">main</span> before the completion window expires. We'll email confirmation immediately.
              </p>
            </div>
            {repo && (
              <div className="rounded-lg border border-dashed border-blue-200 bg-blue-50 p-4 text-xs text-blue-700">
                Repo already provisioned at <strong>{repo.repoFullName}</strong>. Resume work from your local clone.
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

        <div className="flex justify-end">
          <Button size="lg">Mark as started</Button>
        </div>
      </div>
    </div>
  );
}
