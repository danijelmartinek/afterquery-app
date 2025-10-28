"use client";

import { addHours } from "date-fns";
import { useParams } from "next/navigation";
import { useState } from "react";
import { useAdminData } from "../../../../../../../providers/admin-data-provider";
import { Button } from "../../../../../../../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../../../../../../components/ui/card";
import { Input } from "../../../../../../../components/ui/input";
import { Label } from "../../../../../../../components/ui/label";
import { Badge } from "../../../../../../../components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../../../../../../components/ui/table";
import Link from "next/link";

export default function AssessmentInvitesPage() {
  const params = useParams<{ assessmentId: string }>();
  const { state, dispatch } = useAdminData();
  const assessment = state.assessments.find((item) => item.id === params.assessmentId);
  const [formState, setFormState] = useState({
    candidateName: "",
    candidateEmail: "",
  });

  if (!assessment) {
    return <p className="text-sm text-zinc-500">Assessment not found.</p>;
  }

  const invites = state.invitations.filter((invite) => invite.assessmentId === assessment.id);

  function handleCreateInvite(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!assessment) return;
    if (!formState.candidateEmail) return;
    const sentAt = new Date();
    const startDeadline = addHours(sentAt, assessment.timeToStartHours);
    const completeDeadline = addHours(sentAt, assessment.timeToStartHours + assessment.timeToCompleteHours);

    dispatch({
      type: "createInvitation",
      payload: {
        id: `invite-${crypto.randomUUID()}`,
        assessmentId: assessment.id,
        candidateEmail: formState.candidateEmail,
        candidateName: formState.candidateName || formState.candidateEmail,
        status: "sent",
        startDeadline: startDeadline.toISOString(),
        completeDeadline: completeDeadline.toISOString(),
        startLinkToken: crypto.randomUUID(),
        sentAt: sentAt.toISOString(),
      },
    });

    setFormState({ candidateName: "", candidateEmail: "" });
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Invite candidates</h1>
        <p className="text-sm text-zinc-500">
          Sends via Resend with magic link and Git credential helper instructions from the architecture plan.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">New invitation</CardTitle>
          <CardDescription>Generating an invite will email the candidate instantly.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreateInvite} className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="name">Candidate name</Label>
              <Input
                id="name"
                value={formState.candidateName}
                onChange={(event) => setFormState((prev) => ({ ...prev, candidateName: event.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Candidate email</Label>
              <Input
                id="email"
                type="email"
                required
                value={formState.candidateEmail}
                onChange={(event) => setFormState((prev) => ({ ...prev, candidateEmail: event.target.value }))}
              />
            </div>
            <div className="md:col-span-2 flex justify-end gap-3">
              <Button variant="outline" asChild>
                <Link href={`/app/dashboard/assessments/${assessment.id}`}>Cancel</Link>
              </Button>
              <Button type="submit">Send invite</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Existing invites</CardTitle>
          <CardDescription>Track acceptance and submission status across the cohort.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Start deadline</TableHead>
                <TableHead>Complete deadline</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invites.map((invite) => (
                <TableRow key={invite.id}>
                  <TableCell className="font-medium text-zinc-900">{invite.candidateName}</TableCell>
                  <TableCell>{invite.candidateEmail}</TableCell>
                  <TableCell>
                    <Badge className="capitalize">{invite.status}</Badge>
                  </TableCell>
                  <TableCell>{new Date(invite.startDeadline).toLocaleString()}</TableCell>
                  <TableCell>{invite.completeDeadline ? new Date(invite.completeDeadline).toLocaleString() : "—"}</TableCell>
                </TableRow>
              ))}
              {invites.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="py-6 text-center text-sm text-zinc-500">
                    No invites yet.
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
