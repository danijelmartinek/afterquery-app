import type {
  Assessment,
  CandidateRepo,
  CandidateStartAssessment,
  CandidateStartInvitation,
  CandidateStartSeed,
  Invitation,
  InvitationStatus,
  Seed,
} from "./types";

const RAW_API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";
const API_BASE_URL = RAW_API_BASE.endsWith("/")
  ? RAW_API_BASE.slice(0, RAW_API_BASE.length - 1)
  : RAW_API_BASE;

export type ApiRequestOptions = RequestInit & { accessToken?: string };

async function fetchJson<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const { accessToken, headers, ...init } = options;
  const mergedHeaders = new Headers(headers ?? {});
  if (!mergedHeaders.has("Accept")) {
    mergedHeaders.set("Accept", "application/json");
  }
  if (accessToken) {
    mergedHeaders.set("Authorization", `Bearer ${accessToken}`);
  }

  const response = await fetch(`${API_BASE_URL}${normalizedPath}`, {
    ...init,
    headers: mergedHeaders,
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Request failed: ${response.status} ${detail}`);
  }

  return (await response.json()) as T;
}

export type AdminOverviewResponse<
  TAssessment,
  TInvitation,
  TSeed,
  TRepo,
  TComment,
  TTemplate,
  TUser,
  TOrg,
  TMembership
> = {
  assessments: TAssessment[];
  invitations: TInvitation[];
  seeds: TSeed[];
  candidateRepos: TRepo[];
  reviewComments: TComment[];
  emailTemplates: TTemplate[];
  currentAdmin: TUser | null;
  org: TOrg | null;
  membership: TMembership | null;
};

export async function fetchAdminOverview<
  TAssessment,
  TInvitation,
  TSeed,
  TRepo,
  TComment,
  TTemplate,
  TUser,
  TOrg,
  TMembership
>(options: ApiRequestOptions = {}) {
  return fetchJson<
    AdminOverviewResponse<
      TAssessment,
      TInvitation,
      TSeed,
      TRepo,
      TComment,
      TTemplate,
      TUser,
      TOrg,
      TMembership
    >
  >("/api/admin/overview", { cache: "no-store", ...options });
}

type CandidateStartInvitationResponse = {
  id: string;
  assessmentId: string;
  candidateEmail: string;
  candidateName?: string | null;
  status: InvitationStatus;
  startDeadline?: string | null;
  completeDeadline?: string | null;
  sentAt: string;
  startedAt?: string | null;
  submittedAt?: string | null;
};

type CandidateStartAssessmentResponse = {
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

type CandidateStartSeedResponse = {
  id: string;
  seedRepo: string;
  latestMainSha?: string | null;
  sourceRepoUrl: string;
};

type CandidateStartRepoResponse = {
  id: string;
  invitationId: string;
  repoFullName: string;
  repoHtmlUrl?: string | null;
  seedShaPinned: string;
  startedAt: string;
  lastCommitAt?: string | null;
};

type CandidateStartResponse = {
  invitation: CandidateStartInvitationResponse;
  assessment: CandidateStartAssessmentResponse;
  seed: CandidateStartSeedResponse;
  candidateRepo?: CandidateStartRepoResponse | null;
};

export type CandidateStartData = {
  invitation: CandidateStartInvitation;
  assessment: CandidateStartAssessment;
  seed: CandidateStartSeed;
  candidateRepo?: CandidateRepo;
};

export async function fetchCandidateStart(
  token: string,
  options: ApiRequestOptions = {},
): Promise<CandidateStartData> {
  const response = await fetchJson<CandidateStartResponse>(
    `/api/start/${encodeURIComponent(token)}`,
    { cache: "no-store", ...options },
  );

  const invitation: CandidateStartInvitation = {
    id: response.invitation.id,
    assessmentId: response.invitation.assessmentId,
    candidateEmail: response.invitation.candidateEmail,
    candidateName:
      response.invitation.candidateName ?? response.invitation.candidateEmail,
    status: response.invitation.status,
    startDeadline: response.invitation.startDeadline ?? null,
    completeDeadline: response.invitation.completeDeadline ?? null,
    sentAt: response.invitation.sentAt,
    startedAt: response.invitation.startedAt ?? null,
    submittedAt: response.invitation.submittedAt ?? null,
  };

  const assessment: CandidateStartAssessment = {
    id: response.assessment.id,
    seedId: response.assessment.seedId,
    title: response.assessment.title,
    description: response.assessment.description ?? null,
    instructions: response.assessment.instructions ?? null,
    candidateEmailSubject: response.assessment.candidateEmailSubject ?? null,
    candidateEmailBody: response.assessment.candidateEmailBody ?? null,
    timeToStartHours: response.assessment.timeToStartHours,
    timeToCompleteHours: response.assessment.timeToCompleteHours,
  };

  const seed: CandidateStartSeed = {
    id: response.seed.id,
    seedRepo: response.seed.seedRepo,
    latestMainSha: response.seed.latestMainSha ?? null,
    sourceRepoUrl: response.seed.sourceRepoUrl,
  };

  const candidateRepo: CandidateRepo | undefined = response.candidateRepo
    ? {
        id: response.candidateRepo.id,
        invitationId: response.candidateRepo.invitationId,
        repoFullName: response.candidateRepo.repoFullName,
        repoHtmlUrl: response.candidateRepo.repoHtmlUrl ?? null,
        seedShaPinned: response.candidateRepo.seedShaPinned,
        startedAt: response.candidateRepo.startedAt,
        lastCommitAt: response.candidateRepo.lastCommitAt ?? null,
      }
    : undefined;

  return {
    invitation,
    assessment,
    seed,
    candidateRepo,
  };
}

export type CreateSeedPayload = {
  orgId: string;
  sourceRepoUrl: string;
  seedRepoFullName: string;
  defaultBranch: string;
  isTemplate?: boolean;
  latestMainSha?: string | null;
};

type SeedReadResponse = {
  id: string;
  org_id: string;
  source_repo_url: string;
  seed_repo_full_name: string;
  default_branch: string;
  is_template: boolean;
  latest_main_sha: string | null;
  created_at: string;
};

export async function createSeed(payload: CreateSeedPayload, options: ApiRequestOptions = {}) {
  const body = {
    org_id: payload.orgId,
    source_repo_url: payload.sourceRepoUrl,
    seed_repo_full_name: payload.seedRepoFullName,
    default_branch: payload.defaultBranch,
    is_template: payload.isTemplate ?? true,
    latest_main_sha: payload.latestMainSha ?? null,
  };

  const seed = await fetchJson<SeedReadResponse>("/api/seeds", {
    ...options,
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(options.headers ?? {}),
    },
    body: JSON.stringify(body),
  });

  const normalized: Seed = {
    id: seed.id,
    sourceRepoUrl: seed.source_repo_url,
    seedRepo: seed.seed_repo_full_name,
    latestMainSha: seed.latest_main_sha,
    createdAt: seed.created_at,
  };

  return normalized;
}

export type CreateAssessmentPayload = {
  orgId: string;
  seedId: string;
  title: string;
  description: string;
  instructions: string;
  candidateEmailSubject: string;
  candidateEmailBody: string;
  timeToStartHours: number;
  timeToCompleteHours: number;
  createdBy?: string | null;
};

type AssessmentReadResponse = {
  id: string;
  org_id: string;
  seed_id: string;
  title: string;
  description: string | null;
  instructions: string | null;
  candidate_email_subject: string | null;
  candidate_email_body: string | null;
  time_to_start: number | string;
  time_to_complete: number | string;
  created_by: string | null;
  created_at: string;
};

export async function createAssessment(
  payload: CreateAssessmentPayload,
  options: ApiRequestOptions = {},
) {
  const body = {
    org_id: payload.orgId,
    seed_id: payload.seedId,
    title: payload.title,
    description: payload.description || null,
    instructions: payload.instructions || null,
    candidate_email_subject: payload.candidateEmailSubject || null,
    candidate_email_body: payload.candidateEmailBody || null,
    time_to_start: payload.timeToStartHours * 3600,
    time_to_complete: payload.timeToCompleteHours * 3600,
    created_by: payload.createdBy ?? null,
  };

  const assessment = await fetchJson<AssessmentReadResponse>("/api/assessments", {
    ...options,
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(options.headers ?? {}),
    },
    body: JSON.stringify(body),
  });

  const toHours = (value: number | string | null | undefined) => {
    if (typeof value === "number") {
      return Math.round(value / 3600);
    }
    if (typeof value === "string") {
      const numeric = Number(value);
      if (!Number.isNaN(numeric)) {
        return Math.round(numeric / 3600);
      }
    }
    return 0;
  };

  const normalized: Assessment = {
    id: assessment.id,
    orgId: assessment.org_id,
    seedId: assessment.seed_id,
    title: assessment.title,
    description: assessment.description,
    instructions: assessment.instructions,
    candidateEmailSubject: assessment.candidate_email_subject,
    candidateEmailBody: assessment.candidate_email_body,
    timeToStartHours: toHours(assessment.time_to_start),
    timeToCompleteHours: toHours(assessment.time_to_complete),
    createdBy: assessment.created_by,
    createdAt: assessment.created_at,
  };

  return normalized;
}

type InvitationReadResponse = {
  id: string;
  assessment_id: string;
  candidate_email: string;
  candidate_name: string | null;
  status: string;
  start_deadline: string | null;
  complete_deadline: string | null;
  start_link_token: string;
  sent_at: string;
  started_at?: string | null;
  submitted_at?: string | null;
};

export type CreateInvitationPayload = {
  candidateEmail: string;
  candidateName?: string;
};

export async function createInvitations(
  assessmentId: string,
  invitations: CreateInvitationPayload[],
  options: ApiRequestOptions = {},
) {
  const body = {
    assessment_id: assessmentId,
    invitations: invitations.map((invite) => ({
      candidate_email: invite.candidateEmail,
      candidate_name: invite.candidateName ?? invite.candidateEmail,
    })),
  };

  const created = await fetchJson<InvitationReadResponse[]>("/api/invitations", {
    ...options,
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(options.headers ?? {}),
    },
    body: JSON.stringify(body),
  });

  return created.map<Invitation>((invite) => ({
    id: invite.id,
    assessmentId: invite.assessment_id,
    candidateEmail: invite.candidate_email,
    candidateName: invite.candidate_name ?? invite.candidate_email,
    status: invite.status as Invitation["status"],
    startDeadline: invite.start_deadline ?? null,
    completeDeadline: invite.complete_deadline ?? null,
    startLinkToken: invite.start_link_token,
    sentAt: invite.sent_at,
    startedAt: invite.started_at ?? null,
    submittedAt: invite.submitted_at ?? null,
  }));
}
