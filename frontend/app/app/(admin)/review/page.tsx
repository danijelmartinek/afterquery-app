"use client";

import Link from "next/link";
import { useAdminData } from "../../../../providers/admin-data-provider";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../../../components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../../../components/ui/table";
import { Badge } from "../../../../components/ui/badge";
import { Button } from "../../../../components/ui/button";
import { formatDistanceToNow } from "date-fns";

export default function ReviewQueuePage() {
  const { state } = useAdminData();
  const reviewable = state.invitations.filter((invite) => invite.status === "submitted" || invite.status === "started");

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Review queue</h1>
          <p className="text-sm text-zinc-500">
            Jump into candidate repos, compare against seeds, and capture comments for the hiring team.
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href="/app/dashboard/assessments">Back to assessments</Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Candidates</CardTitle>
          <CardDescription>Submitted take-homes are prioritized to the top of the list.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Candidate</TableHead>
                <TableHead>Assessment</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Updated</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {reviewable.map((invite) => {
                const assessment = state.assessments.find((item) => item.id === invite.assessmentId);
                const repo = state.candidateRepos.find((candidate) => candidate.invitationId === invite.id);
                const updatedAt = invite.submittedAt || repo?.lastCommitAt || invite.sentAt;

                return (
                  <TableRow key={invite.id}>
                    <TableCell className="font-medium text-zinc-900">{invite.candidateName}</TableCell>
                    <TableCell>{assessment?.title}</TableCell>
                    <TableCell>
                      <Badge className="capitalize">{invite.status}</Badge>
                    </TableCell>
                    <TableCell className="text-xs text-zinc-500">
                      {formatDistanceToNow(new Date(updatedAt), { addSuffix: true })}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button asChild size="sm">
                        <Link href={`/app/review/${invite.id}`}>Open workspace</Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
              {reviewable.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="py-6 text-center text-sm text-zinc-500">
                    No candidates ready for review.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
