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
  description: string;
  instructions: string;
  candidateEmailSubject: string;
  candidateEmailBody: string;
  timeToStartHours: number;
  timeToCompleteHours: number;
  createdBy: string;
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
  startDeadline: string;
  completeDeadline?: string;
  startLinkToken?: string | null;
  sentAt: string;
  startedAt?: string;
  submittedAt?: string;
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
