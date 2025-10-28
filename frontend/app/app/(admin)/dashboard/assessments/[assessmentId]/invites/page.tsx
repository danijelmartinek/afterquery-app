"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useAdminData } from "../../../../../../../providers/admin-data-provider";
import { useSupabaseAuth } from "../../../../../../../providers/supabase-provider";
import { createInvitations } from "../../../../../../../lib/api";
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
  const { accessToken } = useSupabaseAuth();
  const assessment = state.assessments.find((item) => item.id === params.assessmentId);
  const [formState, setFormState] = useState({
    candidateName: "",
    candidateEmail: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [origin, setOrigin] = useState<string | null>(null);
  const [copyStates, setCopyStates] = useState<Record<string, "copied" | "error">>({});

  if (!assessment) {
    return <p className="text-sm text-zinc-500">Assessment not found.</p>;
  }

  const invites = state.invitations.filter((invite) => invite.assessmentId === assessment.id);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setOrigin(window.location.origin);
    }
  }, []);

  async function handleCreateInvite(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!assessment) return;
    if (!formState.candidateEmail) return;
    if (!accessToken) {
      setError("Sign in to send invitations");
      return;
    }

    setError(null);
    setIsSending(true);
    try {
      const created = await createInvitations(
        assessment.id,
        [
          {
            candidateEmail: formState.candidateEmail,
            candidateName: formState.candidateName,
          },
        ],
        { accessToken },
      );
      created.forEach((invite) => dispatch({ type: "createInvitation", payload: invite }));
      setFormState({ candidateName: "", candidateEmail: "" });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to create invitation";
      setError(message);
    } finally {
      setIsSending(false);
    }
  }

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
    if (!origin || !startLinkToken) {
      setCopyStates((prev) => ({ ...prev, [inviteId]: "error" }));
      scheduleReset(inviteId);
      return;
    }

    try {
      if (!navigator.clipboard) {
        throw new Error("Clipboard API unavailable");
      }
      await navigator.clipboard.writeText(`${origin}/candidates/${startLinkToken}`);
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
            <div className="md:col-span-2 flex flex-col items-end gap-3 sm:flex-row sm:justify-end">
              <Button variant="outline" asChild>
                <Link href={`/app/dashboard/assessments/${assessment.id}`}>Cancel</Link>
              </Button>
              {error ? <p className="text-sm text-red-600">{error}</p> : null}
              <Button type="submit" disabled={isSending}>
                {isSending ? "Sending..." : "Send invite"}
              </Button>
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
                <TableHead className="text-right">Actions</TableHead>
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
                  <TableCell>
                    {invite.startDeadline ? new Date(invite.startDeadline).toLocaleString() : "—"}
                  </TableCell>
                  <TableCell>
                    {invite.completeDeadline ? new Date(invite.completeDeadline).toLocaleString() : "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleCopyInvite(invite.id, invite.startLinkToken)}
                    >
                      {copyStates[invite.id] === "copied"
                        ? "Copied!"
                        : copyStates[invite.id] === "error"
                          ? "Copy failed"
                          : "Copy invite link"}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {invites.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="py-6 text-center text-sm text-zinc-500">
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
