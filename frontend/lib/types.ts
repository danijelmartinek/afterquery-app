export type Seed = {
  id: string;
  sourceRepoUrl: string;
  seedRepo: string;
  latestMainSha: string;
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
  startLinkToken: string;
  sentAt: string;
  startedAt?: string;
  submittedAt?: string;
};

export type CandidateRepo = {
  id: string;
  invitationId: string;
  repoFullName: string;
  repoHtmlUrl: string;
  seedShaPinned: string;
  startedAt: string;
  lastCommitAt?: string;
};

export type ReviewComment = {
  id: string;
  invitationId: string;
  author: string;
  body: string;
  createdAt: string;
};

export type AdminUser = {
  id: string;
  name: string;
  email: string;
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
  subject: string;
  body: string;
  description: string;
  updatedAt: string;
};
