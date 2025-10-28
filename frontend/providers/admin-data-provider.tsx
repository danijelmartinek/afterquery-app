"use client";

import {
  ReactNode,
  createContext,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useState,
  useRef,
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
  AdminMembership,
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
  | { type: "createSeed"; payload: Seed }
  | { type: "createAssessment"; payload: Assessment }
  | { type: "updateAssessment"; payload: Assessment }
  | { type: "createInvitation"; payload: Invitation }
  | {
      type: "updateInvitationStatus";
      payload: { invitationId: string; status: Invitation["status"]; submittedAt?: string };
    };

type WorkspaceStatus = "loading" | "needs_org" | "pending_approval" | "ready";

const AdminDataContext = createContext<
  | ({
      state: AdminDataState;
      dispatch: React.Dispatch<AdminDataAction>;
      currentAdmin: AdminUser | null;
      org: OrgProfile | null;
      membership: AdminMembership | null;
      workspaceStatus: WorkspaceStatus;
      loading: boolean;
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
    case "createSeed":
      return { ...state, seeds: [action.payload, ...state.seeds] };
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
  const [membership, setMembership] = useState<AdminMembership | null>(null);
  const [workspaceStatus, setWorkspaceStatus] = useState<WorkspaceStatus>("loading");
  const [loadingState, setLoadingState] = useState<boolean>(true);
  const hasInitializedRef = useRef(false);

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
      setMembership(null);
      setWorkspaceStatus("loading");
      setLoadingState(false);
      hasInitializedRef.current = false;
      return;
    }

    if (!accessToken) {
      dispatch({ type: "initialize", payload: createEmptyState() });
      setCurrentAdmin(supabaseAdmin);
      setOrg(null);
      setMembership(null);
      setWorkspaceStatus("loading");
      setLoadingState(false);
      hasInitializedRef.current = false;
      return;
    }

    let active = true;
    const controller = new AbortController();
    if (!hasInitializedRef.current) {
      setLoadingState(true);
    }

    fetchAdminOverview<
      Assessment,
      Invitation,
      Seed,
      CandidateRepo,
      ReviewComment,
      EmailTemplate,
      AdminUser,
      OrgProfile,
      AdminMembership
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
        setOrg(data.org ?? null);
        setMembership(data.membership ?? null);
        const status: WorkspaceStatus = !data.org
          ? "needs_org"
          : data.membership && !data.membership.isApproved
          ? "pending_approval"
          : "ready";
        setWorkspaceStatus(status);
        setLoadingState(false);
        hasInitializedRef.current = true;
      })
      .catch((error) => {
        if (!active) return;
        console.error("Failed to load admin overview", error);
        if (!hasInitializedRef.current) {
          dispatch({ type: "initialize", payload: createEmptyState() });
          setCurrentAdmin(supabaseAdmin ?? null);
          setOrg(null);
          setMembership(null);
          setWorkspaceStatus("needs_org");
          setLoadingState(false);
        }
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [accessToken, authLoading, supabaseAdmin, isConfigured]);

  const value = useMemo(
    () => ({
      state,
      dispatch,
      currentAdmin,
      org,
      membership,
      workspaceStatus,
      loading: loadingState,
    }),
    [state, currentAdmin, org, membership, workspaceStatus, loadingState],
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
