"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAdminData } from "@/providers/admin-data-provider";
import { useSupabaseAuth } from "@/providers/supabase-provider";
import { createAssessment, createSeed } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export default function NewAssessmentPage() {
  const router = useRouter();
  const { state, dispatch, currentAdmin, org } = useAdminData();
  const { accessToken, user: supabaseUser } = useSupabaseAuth();
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
  const [showSeedForm, setShowSeedForm] = useState(state.seeds.length === 0);
  const [seedFormState, setSeedFormState] = useState({
    repoInput: "",
    defaultBranch: "main",
  });
  const [seedError, setSeedError] = useState<string | null>(null);
  const [creatingSeed, setCreatingSeed] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    setFormState((prev) => {
      const hasExistingSeed = prev.seedId && state.seeds.some((seed) => seed.id === prev.seedId);
      const fallbackSeedId = state.seeds[0]?.id ?? "";
      if (hasExistingSeed || fallbackSeedId === prev.seedId) {
        return prev;
      }
      return { ...prev, seedId: fallbackSeedId };
    });
  }, [state.seeds]);

  useEffect(() => {
    if (state.seeds.length === 0) {
      setShowSeedForm(true);
    }
  }, [state.seeds.length]);

  if (!org) {
    return null;
  }

  const hasSeeds = state.seeds.length > 0;

  async function handleCreateSeed() {
    if (creatingSeed) return;
    setSeedError(null);

    if (!org) {
      setSeedError("Create or join an organization before adding repositories");
      return;
    }

    const trimmedInput = seedFormState.repoInput.trim();
    if (!trimmedInput) {
      setSeedError("Enter a template repository link");
      return;
    }

    if (!accessToken) {
      setSeedError("Sign in to add repositories");
      return;
    }

    let repoUrl: string;
    let repoFullName: string;
    try {
      const parsed = new URL(
        trimmedInput.startsWith("http://") || trimmedInput.startsWith("https://")
          ? trimmedInput
          : `https://github.com/${trimmedInput}`,
      );
      const pathSegments = parsed.pathname.split("/").filter(Boolean);
      if (pathSegments.length < 2) {
        throw new Error("Invalid repository path");
      }
      repoFullName = `${pathSegments[0]}/${pathSegments[1]}`;
      repoUrl = `https://github.com/${repoFullName}`;
    } catch (error) {
      setSeedError("Enter a valid GitHub repository URL or owner/name");
      return;
    }

    const defaultBranch = seedFormState.defaultBranch.trim() || "main";

    try {
      setCreatingSeed(true);
      const newSeed = await createSeed(
        {
          orgId: org.id,
          sourceRepoUrl: repoUrl,
          defaultBranch,
        },
        { accessToken },
      );
      dispatch({ type: "createSeed", payload: newSeed });
      setFormState((prev) => ({ ...prev, seedId: newSeed.id }));
      setSeedFormState({ repoInput: "", defaultBranch: "main" });
      setShowSeedForm(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to add repository";
      setSeedError(message);
    } finally {
      setCreatingSeed(false);
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!formState.title || !formState.seedId) {
      setFormError("Title and seed are required");
      return;
    }

    if (!accessToken) {
      setFormError("Sign in to create assessments");
      return;
    }

    if (!org) {
      setFormError("Create or join an organization before creating assessments");
      return;
    }

    setFormError(null);
    setIsSubmitting(true);
    try {
      const newAssessment = await createAssessment(
        {
          orgId: org.id,
          seedId: formState.seedId,
          title: formState.title,
          description: formState.description,
          instructions: formState.instructions,
          candidateEmailSubject: formState.candidateEmailSubject,
          candidateEmailBody: formState.candidateEmailBody,
          timeToStartHours: Number(formState.timeToStartHours),
          timeToCompleteHours: Number(formState.timeToCompleteHours),
          createdBy: currentAdmin?.id ?? supabaseUser?.id ?? null,
        },
        { accessToken },
      );

      dispatch({ type: "createAssessment", payload: newAssessment });
      router.push(`/app/dashboard/assessments/${newAssessment.id}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to create assessment";
      setFormError(message);
    } finally {
      setIsSubmitting(false);
    }
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
              <div className="flex items-center justify-between">
                <Label htmlFor="seed">Seed repository</Label>
                <Button
                  type="button"
                  variant="ghost"
                  className="h-auto px-2 py-1 text-xs text-blue-600 hover:text-blue-700"
                  onClick={() => setShowSeedForm((prev) => !prev)}
                >
                  {showSeedForm ? "Hide" : "Add repository"}
                </Button>
              </div>
              <select
                id="seed"
                value={formState.seedId}
                onChange={(event) => setFormState((prev) => ({ ...prev, seedId: event.target.value }))}
                className="h-10 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-200 disabled:cursor-not-allowed disabled:bg-zinc-50"
                disabled={!hasSeeds}
                required={hasSeeds}
              >
                {hasSeeds ? (
                  state.seeds.map((seed) => (
                    <option key={seed.id} value={seed.id}>
                      {seed.seedRepo}
                    </option>
                  ))
                ) : (
                  <option value="">No repositories yet</option>
                )}
              </select>
              {!hasSeeds ? (
                <p className="text-xs text-zinc-500">
                  Add a GitHub repository to use as the starter template for this assessment.
                </p>
              ) : null}
            </div>
          </div>
          {showSeedForm ? (
            <div className="space-y-4 rounded-lg border border-dashed border-zinc-300 p-4">
              <div className="space-y-2">
                <Label htmlFor="repoInput">Template repository link</Label>
                <Input
                  id="repoInput"
                  placeholder="https://github.com/owner/repo"
                  value={seedFormState.repoInput}
                  onChange={(event) =>
                    setSeedFormState((prev) => ({ ...prev, repoInput: event.target.value }))
                  }
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      handleCreateSeed();
                    }
                  }}
                />
                <p className="text-xs text-zinc-500">
                  Provide a public or template repository. We recommend adding the GitHub App before
                  inviting candidates.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="defaultBranch">Default branch</Label>
                <Input
                  id="defaultBranch"
                  value={seedFormState.defaultBranch}
                  onChange={(event) =>
                    setSeedFormState((prev) => ({ ...prev, defaultBranch: event.target.value }))
                  }
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      handleCreateSeed();
                    }
                  }}
                />
                <p className="text-xs text-zinc-500">
                  We’ll rename the source default branch to match what you enter here (defaults to main).
                </p>
              </div>
              {seedError ? <p className="text-xs text-red-600">{seedError}</p> : null}
              <div className="flex items-center justify-end gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setSeedFormState({ repoInput: "", defaultBranch: "main" });
                    setSeedError(null);
                    setShowSeedForm(false);
                  }}
                >
                  Cancel
                </Button>
                <Button type="button" onClick={handleCreateSeed} disabled={creatingSeed}>
                  {creatingSeed ? "Saving..." : "Save repository"}
                </Button>
              </div>
            </div>
          ) : null}
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
        {formError ? <p className="flex-1 text-sm text-red-600">{formError}</p> : <span className="flex-1" />}
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Saving..." : "Save and continue"}
        </Button>
      </div>
    </form>
  );
}
