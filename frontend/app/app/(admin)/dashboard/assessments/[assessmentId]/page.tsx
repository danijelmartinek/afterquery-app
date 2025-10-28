"use client";

import { notFound, useParams } from "next/navigation";
import ReactMarkdown from "react-markdown";
import { useAdminData } from "../../../../../../providers/admin-data-provider";
import { Button } from "../../../../../../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../../../../../components/ui/card";
import { Badge } from "../../../../../../components/ui/badge";
import Link from "next/link";
import { format } from "date-fns";
import { useEffect, useState } from "react";
import { buildCandidateStartLink, candidateBaseFromEnv } from "../../../../../../lib/invite-links";

export default function AssessmentDetailPage() {
  const params = useParams<{ assessmentId: string }>();
  const { state } = useAdminData();

  const assessment = state.assessments.find((item) => item.id === params.assessmentId);
  if (!assessment) {
    notFound();
  }
  const seed = state.seeds.find((item) => item.id === assessment.seedId);
  const invites = state.invitations.filter((invite) => invite.assessmentId === assessment.id);

  const [runtimeOrigin, setRuntimeOrigin] = useState<string | null>(candidateBaseFromEnv);
  const [copyStates, setCopyStates] = useState<Record<string, "copied" | "error">>({});

  useEffect(() => {
    if (!candidateBaseFromEnv && typeof window !== "undefined") {
      setRuntimeOrigin(window.location.origin);
    }
  }, []);

  function scheduleReset(inviteId: string) {
    setTimeout(() => {
      setCopyStates((prev) => {
        if (!(inviteId in prev)) {
          return prev;
        }
        const { [inviteId]: _, ...rest } = prev;
        return rest;
      });
    }, 2000);
  }

  async function handleCopyInvite(inviteId: string, startLinkToken?: string | null) {
    const inviteLink = buildCandidateStartLink(startLinkToken, runtimeOrigin);
    if (!inviteLink) {
      setCopyStates((prev) => ({ ...prev, [inviteId]: "error" }));
      scheduleReset(inviteId);
      return;
    }

    try {
      if (!navigator.clipboard) {
        throw new Error("Clipboard API unavailable");
      }
      await navigator.clipboard.writeText(inviteLink);
      setCopyStates((prev) => ({ ...prev, [inviteId]: "copied" }));
      scheduleReset(inviteId);
    } catch (copyError) {
      console.error("Failed to copy invite link", copyError);
      setCopyStates((prev) => ({ ...prev, [inviteId]: "error" }));
      scheduleReset(inviteId);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-zinc-500">Seed: {seed?.seedRepo}</p>
          <h1 className="mt-1 text-2xl font-semibold text-zinc-900">{assessment.title}</h1>
          <p className="mt-2 max-w-2xl text-sm text-zinc-500">
            {assessment.description ?? "No description provided yet."}
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild>
            <Link href={`/app/dashboard/assessments/${assessment.id}/invites`}>Manage invites</Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Candidate instructions</CardTitle>
            <CardDescription>Rendered Markdown shown on the candidate start page.</CardDescription>
          </CardHeader>
          <CardContent className="prose prose-zinc max-w-none">
            <ReactMarkdown>{assessment.instructions ?? ""}</ReactMarkdown>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Time windows</CardTitle>
            <CardDescription>Deadlines are calculated when invites are sent and started.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-zinc-600">
            <div>
              <p className="text-xs uppercase tracking-wide text-zinc-400">Time to start</p>
              <p className="text-lg font-semibold text-zinc-900">{assessment.timeToStartHours} hours</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-zinc-400">Time to complete</p>
              <p className="text-lg font-semibold text-zinc-900">{assessment.timeToCompleteHours} hours</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-zinc-400">Created</p>
              <p>{format(new Date(assessment.createdAt), "MMM d, yyyy")}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-zinc-400">Seed SHA</p>
              <p className="font-mono text-sm">{seed?.latestMainSha}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Invitations</CardTitle>
          <CardDescription>Recent invites tied to this assessment.</CardDescription>
        </CardHeader>
        <CardContent className="divide-y divide-zinc-100">
          {invites.map((invite) => (
            <div key={invite.id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-medium text-zinc-900">{invite.candidateName}</p>
                <p className="text-sm text-zinc-500">{invite.candidateEmail}</p>
              </div>
              <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center">
                <div className="flex items-center gap-3">
                  <Badge className="capitalize">{invite.status}</Badge>
                  <p className="text-xs text-zinc-500">
                    Sent {format(new Date(invite.sentAt), "MMM d, yyyy")}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button asChild size="sm" variant="outline">
                    <Link href={`/app/review/${invite.id}`}>Review</Link>
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleCopyInvite(invite.id, invite.startLinkToken)}
                  >
                    {copyStates[invite.id] === "copied"
                      ? "Copied!"
                      : copyStates[invite.id] === "error"
                        ? "Copy failed"
                        : "Copy invite link"}
                  </Button>
                </div>
              </div>
            </div>
          ))}
          {invites.length === 0 && <p className="py-6 text-sm text-zinc-500">No invites yet.</p>}
        </CardContent>
      </Card>
    </div>
  );
}
