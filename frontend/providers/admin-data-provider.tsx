"use client";

import { ReactNode, createContext, useContext, useMemo, useReducer } from "react";
import {
  adminUser,
  assessments as assessmentSeed,
  candidateRepos as candidateRepoSeed,
  emailTemplates as emailTemplateSeed,
  invitations as invitationSeed,
  orgProfile,
  reviewComments as reviewCommentSeed,
  seeds as seedSeed,
} from "../lib/mock-data";
import type {
  Assessment,
  CandidateRepo,
  EmailTemplate,
  Invitation,
  ReviewComment,
  Seed,
} from "../lib/types";

type AdminDataState = {
  seeds: Seed[];
  assessments: Assessment[];
  invitations: Invitation[];
  candidateRepos: CandidateRepo[];
  reviewComments: ReviewComment[];
  emailTemplates: EmailTemplate[];
};

type AdminDataAction =
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
      currentAdmin: typeof adminUser;
      org: typeof orgProfile;
    })
  | undefined
>(undefined);

function reducer(state: AdminDataState, action: AdminDataAction): AdminDataState {
  switch (action.type) {
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
  const [state, dispatch] = useReducer(reducer, {
    seeds: seedSeed,
    assessments: assessmentSeed,
    invitations: invitationSeed,
    candidateRepos: candidateRepoSeed,
    reviewComments: reviewCommentSeed,
    emailTemplates: emailTemplateSeed,
  });

  const value = useMemo(
    () => ({ state, dispatch, currentAdmin: adminUser, org: orgProfile }),
    [state],
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
