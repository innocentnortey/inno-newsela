import { Banner } from "@/components/ui/banner";
import { RoleNote } from "@/features/frame/conventions";
import type { components } from "@/lib/api-types";
import type { Role } from "@/lib/roles";
import { SEND_BACK_TAG_LABEL, shortHash } from "./state-model";

type Lesson = components["schemas"]["Lesson"];
type IssueList = components["schemas"]["IssueList"];

export function StateBanners({ lesson, role, issues }: { lesson: Lesson; role: Role; issues: IssueList | undefined }) {
  const sb = lesson.send_back;
  let banner: React.ReactNode = null;
  switch (lesson.state) {
    case "generation_failed": {
      const msg = issues?.issues.find((i) => i.level === "blocking" && !i.resolution)?.message;
      banner = (
        <Banner level="blocking" title="This lesson has no draft yet.">
          {msg ? `Generation failed: ${msg}` : null}
        </Banner>
      );
      break;
    }
    case "submitted":
      banner = <Banner level="info" title="Submitted: waiting for approval" />;
      break;
    case "approved":
    case "exported":
      banner = (
        <Banner
          level="success"
          title={`Approved · v${lesson.version_number}${lesson.snapshot ? " · pinned " + shortHash(lesson.snapshot.content_hash) : ""}`}
        />
      );
      break;
    case "changes_requested":
      banner = sb ? (
        <Banner level="advisory" title={`Changes requested by ${sb.by}`}>{`${SEND_BACK_TAG_LABEL[sb.tag]}: ${sb.note}`}</Banner>
      ) : (
        <Banner level="advisory" title="Changes requested" />
      );
      break;
    case "reopened":
      banner = (
        <Banner
          level="info"
          title={sb ? `Reopened by ${sb.by}: ${sb.note}. This is version ${lesson.version_number}.` : `Reopened. This is version ${lesson.version_number}.`}
        />
      );
      break;
    default:
      break;
  }
  return (
    <div className="flex flex-col gap-2">
      {banner ? <div data-testid="state-banner">{banner}</div> : null}
      {role !== "reviewer" ? (
        <div data-testid="role-note">
          <RoleNote>{`You're viewing as ${role === "author" ? "an author" : "an approver"}. Only reviewers edit lessons.`}</RoleNote>
        </div>
      ) : null}
    </div>
  );
}
