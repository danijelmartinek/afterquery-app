const RAW_API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";
const API_BASE_URL = RAW_API_BASE.endsWith("/")
  ? RAW_API_BASE.slice(0, RAW_API_BASE.length - 1)
  : RAW_API_BASE;

async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const response = await fetch(`${API_BASE_URL}${normalizedPath}`, {
    ...init,
    headers: {
      Accept: "application/json",
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Request failed: ${response.status} ${detail}`);
  }

  return (await response.json()) as T;
}

export type AdminOverviewResponse<TAssessment, TInvitation, TSeed, TRepo, TComment, TTemplate, TUser, TOrg> = {
  assessments: TAssessment[];
  invitations: TInvitation[];
  seeds: TSeed[];
  candidateRepos: TRepo[];
  reviewComments: TComment[];
  emailTemplates: TTemplate[];
  currentAdmin: TUser | null;
  org: TOrg;
};

export async function fetchAdminOverview<TAssessment, TInvitation, TSeed, TRepo, TComment, TTemplate, TUser, TOrg>() {
  return fetchJson<
    AdminOverviewResponse<TAssessment, TInvitation, TSeed, TRepo, TComment, TTemplate, TUser, TOrg>
  >("/api/admin/demo-overview", { cache: "no-store" });
}

export type CandidateStartResponse<TInvitation, TAssessment, TSeed, TRepo> = {
  invitation: TInvitation;
  assessment: TAssessment;
  seed: TSeed;
  candidateRepo?: TRepo | null;
};

export async function fetchCandidateStart<TInvitation, TAssessment, TSeed, TRepo>(
  token: string,
) {
  return fetchJson<CandidateStartResponse<TInvitation, TAssessment, TSeed, TRepo>>(
    `/api/start/${encodeURIComponent(token)}`,
    { cache: "no-store" },
  );
}
