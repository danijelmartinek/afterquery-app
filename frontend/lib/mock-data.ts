import { addHours, addMinutes, subDays } from "date-fns";
import type {
  AdminUser,
  Assessment,
  CandidateRepo,
  EmailTemplate,
  Invitation,
  OrgProfile,
  ReviewComment,
  Seed,
} from "./types";

const now = new Date();

export const orgProfile: OrgProfile = {
  id: "org-1",
  name: "Afterquery",
  slug: "afterquery",
};

export const adminUser: AdminUser = {
  id: "user-1",
  name: "Alex Rivera",
  email: "alex@afterquery.com",
  role: "authenticated",
};

export const seeds: Seed[] = [
  {
    id: "seed-1",
    sourceRepoUrl: "https://github.com/example/frontend-seed",
    seedRepo: "afterquery/frontend-seed",
    latestMainSha: "9f3c5d4",
    createdAt: subDays(now, 12).toISOString(),
  },
  {
    id: "seed-2",
    sourceRepoUrl: "https://github.com/example/backend-seed",
    seedRepo: "afterquery/backend-seed",
    latestMainSha: "8ab1ec2",
    createdAt: subDays(now, 6).toISOString(),
  },
];

export const assessments: Assessment[] = [
  {
    id: "assessment-frontend",
    orgId: orgProfile.id,
    seedId: seeds[0].id,
    title: "Frontend System Design",
    description: "Build dashboard and candidate start UX for coding interview platform.",
    instructions: `## Build a responsive dashboard

- Fork repo and follow README instructions
- Implement candidate invite workflow and review diff summary
- Include notes about tradeoffs in README`.trim(),
    candidateEmailSubject: "Your Afterquery coding assessment",
    candidateEmailBody: `Hi {candidate_name},

Thanks for taking the time. Click **Start** below to see your private repo and deadlines.

Good luck!`.trim(),
    timeToStartHours: 72,
    timeToCompleteHours: 48,
    createdBy: adminUser.id,
    createdAt: subDays(now, 5).toISOString(),
  },
  {
    id: "assessment-backend",
    orgId: orgProfile.id,
    seedId: seeds[1].id,
    title: "Token Broker Worker",
    description: "Implement FastAPI worker that mints GitHub tokens for candidate repos.",
    instructions: `## Token Broker Worker

- Implement \`/git/credential\`
- Validate token windows and repo binding
- Include tests covering expiry edge cases`.trim(),
    candidateEmailSubject: "Afterquery platform worker take-home",
    candidateEmailBody: `Welcome {candidate_name},

You'll have access to a seed repo with guidance to build the token broker worker. Reach out if anything blocks you.`.trim(),
    timeToStartHours: 48,
    timeToCompleteHours: 24,
    createdBy: adminUser.id,
    createdAt: subDays(now, 10).toISOString(),
  },
];

export const invitations: Invitation[] = [
  {
    id: "invite-1",
    assessmentId: assessments[0].id,
    candidateEmail: "casey@example.com",
    candidateName: "Casey Lee",
    status: "started",
    startDeadline: addHours(now, 12).toISOString(),
    completeDeadline: addHours(now, 60).toISOString(),
    startLinkToken: "tok_casey",
    sentAt: subDays(now, 1).toISOString(),
    startedAt: subDays(now, 0.5).toISOString(),
  },
  {
    id: "invite-2",
    assessmentId: assessments[0].id,
    candidateEmail: "samira@example.com",
    candidateName: "Samira Khan",
    status: "sent",
    startDeadline: addHours(now, 36).toISOString(),
    startLinkToken: "tok_samira",
    sentAt: subDays(now, 0.2).toISOString(),
  },
  {
    id: "invite-3",
    assessmentId: assessments[1].id,
    candidateEmail: "mike@example.com",
    candidateName: "Mike Chen",
    status: "submitted",
    startDeadline: subDays(now, 3).toISOString(),
    completeDeadline: subDays(now, 1).toISOString(),
    startLinkToken: "tok_mike",
    sentAt: subDays(now, 6).toISOString(),
    startedAt: subDays(now, 4).toISOString(),
    submittedAt: subDays(now, 1).toISOString(),
  },
];

export const candidateRepos: CandidateRepo[] = [
  {
    id: "repo-1",
    invitationId: invitations[0].id,
    repoFullName: "afterquery/casey-frontend",
    repoHtmlUrl: "https://github.com/afterquery/casey-frontend",
    seedShaPinned: seeds[0].latestMainSha ?? "",
    startedAt: subDays(now, 0.5).toISOString(),
    lastCommitAt: addMinutes(subDays(now, 0.1), -12).toISOString(),
  },
  {
    id: "repo-2",
    invitationId: invitations[2].id,
    repoFullName: "afterquery/mike-broker",
    repoHtmlUrl: "https://github.com/afterquery/mike-broker",
    seedShaPinned: seeds[1].latestMainSha ?? "",
    startedAt: subDays(now, 4).toISOString(),
    lastCommitAt: subDays(now, 1).toISOString(),
  },
];

export const reviewComments: ReviewComment[] = [
  {
    id: "comment-1",
    invitationId: invitations[2].id,
    author: "Alex Rivera",
    body: "Great job covering expiry window edge cases!",
    createdAt: subDays(now, 1).toISOString(),
  },
  {
    id: "comment-2",
    invitationId: invitations[2].id,
    author: "Jamie Blake",
    body: "Consider adding retries when the GitHub API rate limits the broker.",
    createdAt: subDays(now, 0.8).toISOString(),
  },
];

export const emailTemplates: EmailTemplate[] = [
  {
    id: "email-invite",
    orgId: orgProfile.id,
    name: "Default Invite",
    subject: "You're invited to an Afterquery assessment",
    body: `Hi {candidate_name},

You're invited to complete {assessment_title}. Click the secure link to begin. You'll have until {start_deadline} to start and {complete_deadline} to submit once started.`.trim(),
    description: "Baseline invite used for most assessments",
    updatedAt: subDays(now, 9).toISOString(),
  },
  {
    id: "email-followup",
    orgId: orgProfile.id,
    name: "Follow-Up",
    subject: "Thanks for completing your Afterquery assessment",
    body: `Hi {candidate_name},

Thanks again for submitting {assessment_title}. Our team will review everything and follow up soon.`.trim(),
    description: "Send to candidates post-review",
    updatedAt: subDays(now, 4).toISOString(),
  },
];
