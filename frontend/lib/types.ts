export type Seed = {
  id: string;
  sourceRepoUrl: string;
  seedRepo: string;
  latestMainSha: string | null;
  createdAt: string;
};

export type Assessment = {
  id: string;
  orgId: string;
  seedId: string;
  title: string;
  description: string | null;
  instructions: string | null;
  candidateEmailSubject: string | null;
  candidateEmailBody: string | null;
  timeToStartHours: number;
  timeToCompleteHours: number;
  createdBy: string | null;
  createdAt: string;
};

export type InvitationStatus =
  | "sent"
  | "accepted"
  | "started"
  | "submitted"
  | "expired"
  | "revoked";

export type Invitation = {
  id: string;
  assessmentId: string;
  candidateEmail: string;
  candidateName: string;
  status: InvitationStatus;
  startDeadline: string | null;
  completeDeadline: string | null;
  startLinkToken?: string | null;
  sentAt: string;
  startedAt?: string | null;
  submittedAt?: string | null;
};

export type CandidateRepo = {
  id: string;
  invitationId: string;
  repoFullName: string;
  repoHtmlUrl: string | null;
  seedShaPinned: string;
  startedAt: string;
  lastCommitAt?: string | null;
};

export type CandidateStartInvitation = {
  id: string;
  assessmentId: string;
  candidateEmail: string;
  candidateName: string;
  status: InvitationStatus;
  startDeadline: string | null;
  completeDeadline: string | null;
  sentAt: string;
  startedAt: string | null;
  submittedAt: string | null;
};

export type CandidateStartAssessment = {
  id: string;
  seedId: string;
  title: string;
  description: string | null;
  instructions: string | null;
  candidateEmailSubject: string | null;
  candidateEmailBody: string | null;
  timeToStartHours: number;
  timeToCompleteHours: number;
};

export type CandidateStartSeed = {
  id: string;
  seedRepo: string;
  latestMainSha: string | null;
  sourceRepoUrl: string;
};

export type CandidateStartActionResult = {
  invitationId: string;
  status: InvitationStatus;
  startedAt: string;
  completeDeadline: string | null;
  candidateRepo: CandidateRepo;
  accessToken: string;
  accessTokenExpiresAt: string;
};

export type CandidateSubmitResult = {
  invitationId: string;
  submissionId: string;
  finalSha: string;
  submittedAt: string;
  status: InvitationStatus;
};

export type ReviewComment = {
  id: string;
  invitationId: string;
  author: string | null;
  body: string;
  createdAt: string;
};

export type AdminUser = {
  id: string;
  name: string | null;
  email: string | null;
  role: string | null;
};

export type AdminMembership = {
  orgId: string;
  supabaseUserId: string;
  role: string;
  isApproved: boolean;
};

export type OrgProfile = {
  id: string;
  name: string;
  slug: string;
};

export type EmailTemplate = {
  id: string;
  orgId: string;
  name: string;
  subject: string | null;
  body: string | null;
  description: string | null;
  updatedAt: string;
};
