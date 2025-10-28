"use client";

import Link from "next/link";
import { notFound, useParams } from "next/navigation";
import { useMemo, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { useAdminData } from "../../../../../providers/admin-data-provider";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../../../../components/ui/card";
import { Button } from "../../../../../components/ui/button";
import { Badge } from "../../../../../components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../../../../components/ui/tabs";
import { Textarea } from "../../../../../components/ui/textarea";
import { markInvitationSubmitted } from "../../../../../lib/api";
import { useSupabaseAuth } from "../../../../../providers/supabase-provider";

export default function ReviewWorkspacePage() {
  const params = useParams<{ invitationId: string }>();
  const { state, dispatch } = useAdminData();
  const { accessToken } = useSupabaseAuth();
  const invitation = state.invitations.find((item) => item.id === params.invitationId);

  if (!invitation) {
    notFound();
    return null;
  }

  const activeInvitation = invitation;
  const assessment = state.assessments.find((item) => item.id === activeInvitation.assessmentId);
  const repo = state.candidateRepos.find((item) => item.invitationId === activeInvitation.id);
  const comments = state.reviewComments.filter((comment) => comment.invitationId === activeInvitation.id);
  const [draftComment, setDraftComment] = useState("");

  const lastActivity = useMemo(() => {
    if (activeInvitation.submittedAt) return activeInvitation.submittedAt;
    if (repo?.lastCommitAt) return repo.lastCommitAt;
    return activeInvitation.sentAt;
  }, [activeInvitation.sentAt, activeInvitation.submittedAt, repo?.lastCommitAt]);

  const [markingSubmitted, setMarkingSubmitted] = useState(false);
  const [markError, setMarkError] = useState<string | null>(null);

  async function handleMarkSubmitted() {
    if (activeInvitation.status === "submitted") {
      return;
    }

    if (!accessToken) {
      setMarkError("Sign in to update the submission status.");
      return;
    }

    setMarkError(null);
    setMarkingSubmitted(true);
    try {
      const updated = await markInvitationSubmitted(activeInvitation.id, { accessToken });
      dispatch({
        type: "updateInvitationStatus",
        payload: {
          invitationId: updated.id,
          status: updated.status,
          submittedAt: updated.submittedAt ?? undefined,
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to update submission status.";
      setMarkError(message);
    } finally {
      setMarkingSubmitted(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm text-zinc-500">{assessment?.title}</p>
          <h1 className="text-2xl font-semibold text-zinc-900">{activeInvitation.candidateName}</h1>
          <p className="text-xs uppercase tracking-wide text-zinc-400">
            Status <Badge className="ml-2 capitalize">{activeInvitation.status}</Badge>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {activeInvitation.status !== "submitted" && (
            <Button variant="outline" onClick={handleMarkSubmitted} disabled={markingSubmitted}>
              {markingSubmitted ? "Marking..." : "Mark submitted"}
            </Button>
          )}
          {repo?.repoHtmlUrl && (
            <Button asChild>
              <Link href={repo.repoHtmlUrl} target="_blank">
                View repo
              </Link>
            </Button>
          )}
        </div>
      </div>

      {markError && <p className="text-sm text-red-600">{markError}</p>}

      <Tabs defaultValue="summary">
        <TabsList>
          <TabsTrigger value="summary">Summary</TabsTrigger>
          <TabsTrigger value="diff">Diff guidance</TabsTrigger>
          <TabsTrigger value="feedback">Feedback</TabsTrigger>
        </TabsList>
        <TabsContent value="summary">
          <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Repository</CardTitle>
                <CardDescription>Token broker locks default branch once submitted.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 text-sm text-zinc-600">
                <div>
                  <p className="text-xs uppercase tracking-wide text-zinc-400">GitHub repo</p>
                  <p className="font-medium text-zinc-900">{repo?.repoFullName ?? "Not provisioned"}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-zinc-400">Seed SHA</p>
                  <p className="font-mono text-xs">{repo?.seedShaPinned}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-zinc-400">Last activity</p>
                  <p>{formatDistanceToNow(new Date(lastActivity), { addSuffix: true })}</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Timeline</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-xs text-zinc-500">
                <p>Invite sent {formatDistanceToNow(new Date(activeInvitation.sentAt), { addSuffix: true })}</p>
                {activeInvitation.startedAt && (
                  <p>Started {formatDistanceToNow(new Date(activeInvitation.startedAt), { addSuffix: true })}</p>
                )}
                {activeInvitation.submittedAt && (
                  <p>Submitted {formatDistanceToNow(new Date(activeInvitation.submittedAt), { addSuffix: true })}</p>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
        <TabsContent value="diff">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Diff guidance</CardTitle>
              <CardDescription>Embed GitHub compare URLs or cached diff JSON for reviewers.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-zinc-600">
              {repo ? (
                <>
                  <p>
                    Launch compare view:
                    <br />
                    <Link
                      className="text-blue-600"
                      href={`https://github.com/${repo.repoFullName}/compare/${repo.seedShaPinned}...main`}
                      target="_blank"
                    >
                      github.com/{repo.repoFullName}/compare/{repo.seedShaPinned}...main
                    </Link>
                  </p>
                  <p>
                    Token gateway ensures candidates cannot push after submission. Use cached diff metadata to annotate key
                    files here in future iterations.
                  </p>
                </>
              ) : (
                <p>No repository yet. Candidate must start the assessment to generate a private repo.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="feedback">
          <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Reviewer comments</CardTitle>
                <CardDescription>Share async feedback and follow-up talking points.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {comments.map((comment) => (
                  <div key={comment.id} className="rounded-lg border border-zinc-200 bg-white p-4">
                    <p className="text-sm font-semibold text-zinc-800">{comment.author}</p>
                    <p className="mt-1 text-sm text-zinc-600">{comment.body}</p>
                    <p className="mt-2 text-xs text-zinc-400">
                      {formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true })}
                    </p>
                  </div>
                ))}
                {comments.length === 0 && <p className="text-sm text-zinc-500">No feedback captured yet.</p>}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Record new note</CardTitle>
                <CardDescription>Future backend will persist notes via FastAPI webhook.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Textarea
                  value={draftComment}
                  onChange={(event) => setDraftComment(event.target.value)}
                  placeholder="Summarize strengths, gaps, and follow-up recommendations"
                />
                <Button type="button" disabled={!draftComment.trim()}>
                  Save draft (coming soon)
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
