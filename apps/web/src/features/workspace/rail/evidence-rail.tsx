"use client";
import type { ReactNode } from "react";
import { SideRail } from "@/components/layout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CantLoad } from "@/features/frame/conventions";
import type { components } from "@/lib/api-types";
import { IssuesTab } from "./issues-tab";
import { OutlineRowTab } from "./outline-row-tab";
import { StandardsTab } from "./standards-tab";

type Lesson = components["schemas"]["Lesson"];
type Issue = components["schemas"]["Issue"];
type IssueList = components["schemas"]["IssueList"];

export type RailTab = "issues" | "standards" | "outline-row";

export interface EvidenceRailProps {
  lesson: Lesson;
  issues: IssueList | undefined;
  issuesFailed: boolean;
  onRetryIssues: () => void;
  tab: RailTab;
  onTab: (tab: RailTab) => void;
  selectedIssueId: string | null;
  onGo: (issue: Issue) => void;
  selectedCode: string | null;
  onSelectCode: (code: string) => void;
  /** SLOT NL-65 / NL-66: per-issue buttons. SLOT NL-64: per-standard buttons. */
  renderIssueActions?: (issue: Issue) => ReactNode;
  renderStandardActions?: (std: Lesson["front_matter"]["standards"][number]) => ReactNode;
}

export function EvidenceRail(p: EvidenceRailProps) {
  const openCount = p.issues ? p.issues.issues.filter((i) => !i.resolution).length : undefined;
  return (
    <SideRail title="Evidence">
      <Tabs value={p.tab} onValueChange={(v) => p.onTab(v as RailTab)}>
        <TabsList aria-label="Evidence">
          <TabsTrigger value="issues" count={openCount}>Issues</TabsTrigger>
          <TabsTrigger value="standards" count={p.lesson.front_matter.standards.length}>Standards</TabsTrigger>
          <TabsTrigger value="outline-row">Outline row</TabsTrigger>
        </TabsList>
        <TabsContent value="issues" className="pt-3">
          {p.issues ? (
            <IssuesTab issues={p.issues} sections={p.lesson.sections} selectedId={p.selectedIssueId} onGo={p.onGo} renderActions={p.renderIssueActions} />
          ) : p.issuesFailed ? (
            <CantLoad thing="the issues" onRetry={p.onRetryIssues} />
          ) : (
            <p className="text-small text-ink2">Checking…</p>
          )}
        </TabsContent>
        <TabsContent value="standards" className="pt-3">
          <StandardsTab lesson={p.lesson} selectedCode={p.selectedCode} onSelect={p.onSelectCode} renderActions={p.renderStandardActions} />
        </TabsContent>
        <TabsContent value="outline-row" className="pt-3">
          <OutlineRowTab row={p.lesson.outline_row} />
        </TabsContent>
      </Tabs>
    </SideRail>
  );
}
