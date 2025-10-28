import { notFound } from "next/navigation";
import { CandidateStartView } from "../../../components/candidate/candidate-start-view";
import { fetchCandidateStart } from "../../../lib/api";
import type { Assessment, CandidateRepo, Invitation, Seed } from "../../../lib/types";

export default function CandidateStartPage({
  params,
}: {
  params: { inviteToken: string };
}) {
  return <CandidateStartContent inviteToken={params.inviteToken} />;
}

async function CandidateStartContent({ inviteToken }: { inviteToken: string }) {
  type InvitationPayload = {
    id: string;
    assessmentId: string;
    candidateEmail: string;
    candidateName?: string | null;
    status: Invitation["status"];
    startDeadline?: string | null;
    completeDeadline?: string | null;
    sentAt: string;
    startedAt?: string | null;
    submittedAt?: string | null;
  };

  type AssessmentPayload = {
    id: string;
    seedId: string;
    title: string;
    description?: string | null;
    instructions?: string | null;
    candidateEmailSubject?: string | null;
    candidateEmailBody?: string | null;
    timeToStartHours: number;
    timeToCompleteHours: number;
  };

  type SeedPayload = {
    id: string;
    seedRepo: string;
    latestMainSha?: string | null;
    sourceRepoUrl: string;
  };

  type RepoPayload = {
    id: string;
    invitationId: string;
    repoFullName: string;
    repoHtmlUrl?: string | null;
    seedShaPinned: string;
    startedAt: string;
    lastCommitAt?: string | null;
  };

  try {
    const data = await fetchCandidateStart<
      InvitationPayload,
      AssessmentPayload,
      SeedPayload,
      RepoPayload
    >(inviteToken);

    const invitationPayload = data.invitation;
    const assessmentPayload = data.assessment;
    const seedPayload = data.seed;

    if (!invitationPayload || !assessmentPayload || !seedPayload) {
      notFound();
    }

    const invitation: Invitation = {
      id: invitationPayload.id,
      assessmentId: invitationPayload.assessmentId,
      candidateEmail: invitationPayload.candidateEmail,
      candidateName: invitationPayload.candidateName ?? invitationPayload.candidateEmail,
      status: invitationPayload.status,
      startDeadline: invitationPayload.startDeadline ?? invitationPayload.sentAt,
      completeDeadline: invitationPayload.completeDeadline ?? undefined,
      startLinkToken: inviteToken,
      sentAt: invitationPayload.sentAt,
      startedAt: invitationPayload.startedAt ?? undefined,
      submittedAt: invitationPayload.submittedAt ?? undefined,
    };

    const nowIso = new Date().toISOString();

    const assessment: Assessment = {
      id: assessmentPayload.id,
      orgId: "",
      seedId: assessmentPayload.seedId,
      title: assessmentPayload.title,
      description: assessmentPayload.description ?? "",
      instructions: assessmentPayload.instructions ?? "",
      candidateEmailSubject: assessmentPayload.candidateEmailSubject ?? "",
      candidateEmailBody: assessmentPayload.candidateEmailBody ?? "",
      timeToStartHours: assessmentPayload.timeToStartHours,
      timeToCompleteHours: assessmentPayload.timeToCompleteHours,
      createdBy: "",
      createdAt: nowIso,
    };

    const seed: Seed = {
      id: seedPayload.id,
      sourceRepoUrl: seedPayload.sourceRepoUrl,
      seedRepo: seedPayload.seedRepo,
      latestMainSha: seedPayload.latestMainSha ?? null,
      createdAt: nowIso,
    };

    const repo: CandidateRepo | undefined = data.candidateRepo
      ? {
          id: data.candidateRepo.id,
          invitationId: data.candidateRepo.invitationId,
          repoFullName: data.candidateRepo.repoFullName,
          repoHtmlUrl: data.candidateRepo.repoHtmlUrl ?? null,
          seedShaPinned: data.candidateRepo.seedShaPinned,
          startedAt: data.candidateRepo.startedAt,
          lastCommitAt: data.candidateRepo.lastCommitAt ?? null,
        }
      : undefined;

    return (
      <CandidateStartView
        invitation={invitation}
        assessment={assessment}
        seed={seed}
        repo={repo}
        startToken={inviteToken}
      />
    );
  } catch (error) {
    if (error instanceof Error && error.message.includes("404")) {
      notFound();
    }
    throw error;
  }
}
