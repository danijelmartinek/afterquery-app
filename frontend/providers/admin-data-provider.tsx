"use client";

import {
  ReactNode,
  createContext,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useState,
} from "react";
import { fetchAdminOverview } from "../lib/api";
import type {
  Assessment,
  CandidateRepo,
  EmailTemplate,
  Invitation,
  ReviewComment,
  Seed,
  AdminUser,
  OrgProfile,
} from "../lib/types";
import { useSupabaseAuth } from "./supabase-provider";

type AdminDataState = {
  seeds: Seed[];
  assessments: Assessment[];
  invitations: Invitation[];
  candidateRepos: CandidateRepo[];
  reviewComments: ReviewComment[];
  emailTemplates: EmailTemplate[];
};

type AdminDataAction =
  | { type: "initialize"; payload: AdminDataState }
  | { type: "createAssessment"; payload: Assessment }
  | { type: "updateAssessment"; payload: Assessment }
  | { type: "createInvitation"; payload: Invitation }
  | {
      type: "updateInvitationStatus";
      payload: { invitationId: string; status: Invitation["status"]; submittedAt?: string };
    };

const AdminDataContext = createContext<
  | ({
      state: AdminDataState;
      dispatch: React.Dispatch<AdminDataAction>;
      currentAdmin: AdminUser;
      org: OrgProfile;
    })
  | undefined
>(undefined);

function createEmptyState(): AdminDataState {
  return {
    seeds: [],
    assessments: [],
    invitations: [],
    candidateRepos: [],
    reviewComments: [],
    emailTemplates: [],
  };
}

function reducer(state: AdminDataState, action: AdminDataAction): AdminDataState {
  switch (action.type) {
    case "initialize":
      return action.payload;
    case "createAssessment":
      return { ...state, assessments: [action.payload, ...state.assessments] };
    case "updateAssessment":
      return {
        ...state,
        assessments: state.assessments.map((assessment) =>
          assessment.id === action.payload.id ? action.payload : assessment,
        ),
      };
    case "createInvitation":
      return { ...state, invitations: [action.payload, ...state.invitations] };
    case "updateInvitationStatus":
      return {
        ...state,
        invitations: state.invitations.map((invitation) =>
          invitation.id === action.payload.invitationId
            ? {
                ...invitation,
                status: action.payload.status,
                submittedAt: action.payload.submittedAt ?? invitation.submittedAt,
              }
            : invitation,
        ),
      };
    default:
      return state;
  }
}

export function AdminDataProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, createEmptyState);

  const [currentAdmin, setCurrentAdmin] = useState<AdminUser | null>(null);
  const [org, setOrg] = useState<OrgProfile | null>(null);

  const { accessToken, loading: authLoading, user: supabaseUser, isConfigured } = useSupabaseAuth();

  const supabaseAdmin = useMemo<AdminUser | null>(() => {
    if (!supabaseUser) {
      return null;
    }
    const metadata = supabaseUser.user_metadata || {};
    const derivedName =
      (typeof metadata.full_name === "string" && metadata.full_name.trim()) ||
      (typeof metadata.name === "string" && metadata.name.trim()) ||
      supabaseUser.email ||
      supabaseUser.id;
    return {
      id: supabaseUser.id,
      email: supabaseUser.email ?? null,
      name: derivedName,
      role: supabaseUser.role ?? null,
    };
  }, [supabaseUser]);

  useEffect(() => {
    if (authLoading) {
      return;
    }

    if (!isConfigured) {
      dispatch({ type: "initialize", payload: createEmptyState() });
      setCurrentAdmin(supabaseAdmin);
      setOrg(null);
      return;
    }

    if (!accessToken) {
      dispatch({ type: "initialize", payload: createEmptyState() });
      setCurrentAdmin(supabaseAdmin);
      setOrg(null);
      return;
    }

    let active = true;
    const controller = new AbortController();

    fetchAdminOverview<
      Assessment,
      Invitation,
      Seed,
      CandidateRepo,
      ReviewComment,
      EmailTemplate,
      AdminUser,
      OrgProfile
    >({ accessToken, signal: controller.signal })
      .then((data) => {
        if (!active) return;
        dispatch({
          type: "initialize",
          payload: {
            seeds: data.seeds ?? [],
            assessments: data.assessments ?? [],
            invitations: data.invitations ?? [],
            candidateRepos: data.candidateRepos ?? [],
            reviewComments: data.reviewComments ?? [],
            emailTemplates: data.emailTemplates ?? [],
          },
        });
        setCurrentAdmin(data.currentAdmin ?? supabaseAdmin ?? null);
        setOrg(data.org);
      })
      .catch((error) => {
        if (!active) return;
        console.error("Failed to load admin overview", error);
        setCurrentAdmin(supabaseAdmin ?? null);
        setOrg(null);
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [accessToken, authLoading, supabaseAdmin, isConfigured]);

  const fallbackAdmin: AdminUser =
    currentAdmin ??
    supabaseAdmin ?? {
      id: "demo-admin",
      name: "Demo Admin",
      email: "demo@example.com",
      role: "authenticated",
    };
  const fallbackOrg: OrgProfile =
    org ?? { id: "demo-org", name: "Demo Organization", slug: "demo-organization" };

  const value = useMemo(
    () => ({ state, dispatch, currentAdmin: fallbackAdmin, org: fallbackOrg }),
    [state, fallbackAdmin, fallbackOrg],
  );

  return <AdminDataContext.Provider value={value}>{children}</AdminDataContext.Provider>;
}

export function useAdminData() {
  const ctx = useContext(AdminDataContext);
  if (!ctx) {
    throw new Error("useAdminData must be used within AdminDataProvider");
  }
  return ctx;
}
