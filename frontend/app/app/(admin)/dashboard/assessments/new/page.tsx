"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAdminData } from "../../../../../../providers/admin-data-provider";
import { Button } from "../../../../../../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../../../../../components/ui/card";
import { Input } from "../../../../../../components/ui/input";
import { Label } from "../../../../../../components/ui/label";
import { Textarea } from "../../../../../../components/ui/textarea";

export default function NewAssessmentPage() {
  const router = useRouter();
  const { state, dispatch, currentAdmin, org } = useAdminData();
  const [formState, setFormState] = useState({
    title: "",
    description: "",
    instructions: "",
    seedId: state.seeds[0]?.id ?? "",
    timeToStartHours: 72,
    timeToCompleteHours: 48,
    candidateEmailSubject: "You're invited to an Afterquery assessment",
    candidateEmailBody: "Hi {candidate_name}, excited to see your work!",
  });

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!formState.title || !formState.seedId) return;

    const assessmentId = `assessment-${crypto.randomUUID()}`;
    dispatch({
      type: "createAssessment",
      payload: {
        id: assessmentId,
        orgId: org.id,
        seedId: formState.seedId,
        title: formState.title,
        description: formState.description,
        instructions: formState.instructions,
        candidateEmailSubject: formState.candidateEmailSubject,
        candidateEmailBody: formState.candidateEmailBody,
        timeToStartHours: Number(formState.timeToStartHours),
        timeToCompleteHours: Number(formState.timeToCompleteHours),
        createdBy: currentAdmin.id,
        createdAt: new Date().toISOString(),
      },
    });

    router.push(`/app/dashboard/assessments/${assessmentId}`);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900">Create assessment</h1>
        <p className="text-sm text-zinc-500">
          Define instructions, pick a seed repo, and customize the candidate email template.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Assessment details</CardTitle>
          <CardDescription>Seeds pin to main at start time. Keep instructions Markdown-friendly.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                value={formState.title}
                onChange={(event) => setFormState((prev) => ({ ...prev, title: event.target.value }))}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="seed">Seed repository</Label>
              <select
                id="seed"
                value={formState.seedId}
                onChange={(event) => setFormState((prev) => ({ ...prev, seedId: event.target.value }))}
                className="h-10 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-200"
              >
                {state.seeds.map((seed) => (
                  <option key={seed.id} value={seed.id}>
                    {seed.seedRepo}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Summary</Label>
            <Textarea
              id="description"
              value={formState.description}
              onChange={(event) => setFormState((prev) => ({ ...prev, description: event.target.value }))}
              placeholder="High-level overview of the take-home"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="instructions">Detailed instructions</Label>
            <Textarea
              id="instructions"
              value={formState.instructions}
              onChange={(event) => setFormState((prev) => ({ ...prev, instructions: event.target.value }))}
              placeholder="Markdown supported guidance for candidates"
              className="min-h-[160px]"
            />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="start">Time to start (hours)</Label>
              <Input
                id="start"
                type="number"
                min={1}
                value={formState.timeToStartHours}
                onChange={(event) => setFormState((prev) => ({ ...prev, timeToStartHours: Number(event.target.value) }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="complete">Time to complete (hours)</Label>
              <Input
                id="complete"
                type="number"
                min={1}
                value={formState.timeToCompleteHours}
                onChange={(event) =>
                  setFormState((prev) => ({ ...prev, timeToCompleteHours: Number(event.target.value) }))
                }
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Candidate email</CardTitle>
          <CardDescription>
            Tokens are merged when sending. Variables:
            <span className="ml-2 space-x-2 text-xs">
              <code>{"{candidate_name}"}</code>
              <code>{"{assessment_title}"}</code>
              <code>{"{start_deadline}"}</code>
              <code>{"{complete_deadline}"}</code>
            </span>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="subject">Subject</Label>
            <Input
              id="subject"
              value={formState.candidateEmailSubject}
              onChange={(event) =>
                setFormState((prev) => ({ ...prev, candidateEmailSubject: event.target.value }))
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="body">Body</Label>
            <Textarea
              id="body"
              value={formState.candidateEmailBody}
              onChange={(event) =>
                setFormState((prev) => ({ ...prev, candidateEmailBody: event.target.value }))
              }
              className="min-h-[160px]"
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-3">
        <Button variant="outline" type="button" onClick={() => router.back()}>
          Cancel
        </Button>
        <Button type="submit">Save and continue</Button>
      </div>
    </form>
  );
}
