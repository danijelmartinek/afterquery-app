import { notFound } from "next/navigation";
import { CandidateStartView } from "../../../components/candidate/candidate-start-view";
import { assessments, candidateRepos, invitations, seeds } from "../../../lib/mock-data";

export default function CandidateStartPage({
  params,
}: {
  params: { inviteToken: string };
}) {
  const invitation = invitations.find((invite) => invite.startLinkToken === params.inviteToken);
  if (!invitation) {
    notFound();
  }
  const assessment = assessments.find((item) => item.id === invitation.assessmentId);
  const repo = candidateRepos.find((item) => item.invitationId === invitation.id);
  const seed = seeds.find((item) => item.id === assessment?.seedId);

  if (!assessment || !seed) {
    notFound();
  }

  return <CandidateStartView invitation={invitation} assessment={assessment} seed={seed} repo={repo} />;
}
