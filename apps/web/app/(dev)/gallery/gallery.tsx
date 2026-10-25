"use client";

import type { ReactNode } from "react";
import { AppShell, PageHeader, TwoPane, SideRail, PageSheet, type NavSection } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Link } from "@/components/ui/link";
import { TextInput, Textarea } from "@/components/ui/text-input";
import { Select } from "@/components/ui/select";
import { Checkbox, Radio, RadioGroup, RadioCard } from "@/components/ui/choice";
import { StatusPill } from "@/components/ui/status-pill";
import { STATUS_SPECS, type StatusKey } from "@/components/ui/status";
import { CapsTag, CountBadge, Marker, VersionChip, CodeChip } from "@/components/ui/badge";
import { Banner } from "@/components/ui/banner";
import { Card, MetricTile } from "@/components/ui/card";
import { Table, Thead, Tbody, Tr, Th, Td } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Stepper } from "@/components/ui/stepper";
import { DialogShell } from "@/components/ui/dialog-shell";
import { Toast, ToastRegion } from "@/components/ui/toast";
import { ThemeSwitch } from "./theme-switch";

const NAV: NavSection[] = [
  {
    id: "units",
    label: "Units",
    items: [
      { id: "u4", label: "Unit 4", href: "#", current: true, count: 47 },
      { id: "reports", label: "Reports", href: "#", count: 2 },
    ],
  },
];

const TOKENS = ["bg-ground", "bg-panel", "bg-primary", "bg-selected", "bg-success", "bg-overlay"];
const STATUS_KEYS = Object.keys(STATUS_SPECS) as StatusKey[];

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section aria-labelledby={`g-${id}`} className="mb-10">
      <h2 id={`g-${id}`} className="text-ink mb-4 text-lg font-semibold">
        {title}
      </h2>
      <div className="flex flex-col gap-4">{children}</div>
    </section>
  );
}

const Row = ({ children }: { children: ReactNode }) => <div className="flex flex-wrap items-center gap-3">{children}</div>;

export function Gallery() {
  return (
    <AppShell navSections={NAV} topBar={<ThemeSwitch />}>
      <PageHeader
        breadcrumb={[{ label: "Units", href: "#" }, { label: "Gallery" }]}
        title="Component gallery"
        actions={<Button variant="primary">Primary action</Button>}
      />

      <Section id="tokens" title="Tokens">
        <Row>
          {TOKENS.map((c) => (
            <div key={c} className="flex flex-col items-center gap-1">
              <div className={`${c} border-hair size-12 rounded-lg border`} />
              <span className="text-small text-ink2">{c.replace("bg-", "")}</span>
            </div>
          ))}
          <div className="flex flex-col items-center gap-1">
            <div className="bg-panel border-edge size-12 rounded-2xl border" />
            <span className="text-small text-ink2">radius</span>
          </div>
        </Row>
      </Section>

      <Section id="buttons" title="Buttons">
        {(["primary", "secondary", "ghost", "danger"] as const).map((v) => (
          <Row key={v}>
            {(["sm", "md", "lg"] as const).map((s) => (
              <Button key={s} variant={v} size={s}>
                {v} {s}
              </Button>
            ))}
            <Button variant={v} loading>
              Saving {v}
            </Button>
            <Button variant={v} disabled disabledReason="Confirm 5 errors first">
              Disabled {v}
            </Button>
          </Row>
        ))}
      </Section>

      <Section id="links" title="Links">
        <Row>
          <Link href="#">Plain link</Link>
          <p className="text-ink">
            Text with an <Link href="#" inText>inline link</Link> inside.
          </p>
          <Link href="https://example.com" external>
            External link
          </Link>
        </Row>
      </Section>

      <Section id="fields" title="Fields">
        <div className="grid max-w-xl gap-4">
          <TextInput label="Unit name" />
          <TextInput label="Filename" help="Use the unit and grade." />
          <TextInput label="Unit code" error="The sheet says G6, U4; every filename says U3." />
          <Textarea label="Reviewer note" />
          <Select
            label="Strand"
            options={[
              { value: "a", label: "Reading literature" },
              { value: "b", label: "Language" },
            ]}
          />
          <Checkbox label="Apply this rule to rows 8 to 23" />
          <Radio name="solo" label="Single radio" />
          <RadioGroup legend="Warning default" required>
            <Radio name="warn" label="Apply" />
            <Radio name="warn" label="Show to reviewer only" />
            <Radio name="warn" label="Ignore" />
          </RadioGroup>
          <RadioGroup legend="Draft quality">
            <RadioCard name="q" label="Usable as drafted" />
            <RadioCard name="q" label="Usable with edits" />
            <RadioCard name="q" label="Rewritten" />
          </RadioGroup>
        </div>
      </Section>

      <Section id="status" title="Status">
        <Row>
          {STATUS_KEYS.map((k) => (
            <StatusPill key={k} status={k} />
          ))}
        </Row>
        <Row>
          <StatusPill status="lesson.submitted" by="J. Rivera" detail="v2" />
        </Row>
      </Section>

      <Section id="badges" title="Badges">
        <Row>
          <CapsTag>Reading</CapsTag>
          <CountBadge count={3} />
          <Marker n={1} />
          <VersionChip version="v3" />
          <CodeChip>RL.6.1</CodeChip>
        </Row>
      </Section>

      <Section id="banners" title="Banners">
        <Banner level="blocking" title="3 blocking issues">
          Quote placeholder open.
        </Banner>
        <Banner level="advisory" title="Advisory">
          ELD.PII.6.5 label names another strand.
        </Banner>
        <Banner level="info" title="Information">
          Lesson 4 is waiting on this lesson&apos;s excerpt.
        </Banner>
        <Banner level="success" title="Saved" action={<Button variant="secondary" size="sm">Undo</Button>}>
          All changes saved.
        </Banner>
      </Section>

      <Section id="cards" title="Cards and metric tiles">
        <div className="grid gap-4 md:grid-cols-3">
          <Card title="Roll-up">Draft 34 · In review 6 · Submitted 2</Card>
          <MetricTile
            title="Reviewer minutes per approved lesson"
            value="24"
            unit="min"
            caption="No baseline yet (AQ-14). Measured with us as reviewers."
          />
          <MetricTile title="Reviewer minutes per approved lesson" value={null} />
          <MetricTile title="Approved" value="3" unit="of 47" note="n = 3" />
        </div>
      </Section>

      <Section id="table" title="Table">
        <Table caption="Unit 4 lessons">
          <Thead>
            <Tr>
              <Th sort="ascending">Lesson</Th>
              <Th>Type</Th>
              <Th>State</Th>
              <Th numeric>Blocking</Th>
              <Th numeric>Advisory</Th>
              <Th>Reviewer</Th>
            </Tr>
          </Thead>
          <Tbody>
            <Tr>
              <Td>Lesson 4</Td>
              <Td>Reading</Td>
              <Td>In review</Td>
              <Td numeric>3</Td>
              <Td numeric>1</Td>
              <Td>M. Okafor</Td>
            </Tr>
          </Tbody>
        </Table>
      </Section>

      <Section id="tabs" title="Tabs">
        <Tabs defaultValue="all">
          <TabsList aria-label="Lesson filter">
            <TabsTrigger value="all" count={47}>All</TabsTrigger>
            <TabsTrigger value="draft" count={34}>Draft</TabsTrigger>
            <TabsTrigger value="review" count={6}>In review</TabsTrigger>
            <TabsTrigger value="submitted" count={2}>Submitted</TabsTrigger>
            <TabsTrigger value="approved" count={3}>Approved</TabsTrigger>
            <TabsTrigger value="failed" count={2}>Failed</TabsTrigger>
          </TabsList>
          <TabsContent value="all">
            <p className="text-ink2 py-3">All 47 lessons.</p>
          </TabsContent>
        </Tabs>
      </Section>

      <Section id="stepper" title="Stepper">
        {([1, 2, 3, 4, 5] as const).map((n) => (
          <Stepper key={n} current={n} aria-label={`Lesson progress, step ${n}`} />
        ))}
      </Section>

      <Section id="dialog" title="Dialog">
        <DialogShell
          trigger={<Button variant="secondary">Open dialog</Button>}
          title="Approve this version"
          description="Approving pins snapshot 9f3c…a21e. If it changes before you approve, you'll be asked to reload."
          footer={<Button variant="primary">Approve this version</Button>}
        >
          <p className="text-ink">You did not edit this lesson, so you can approve it.</p>
        </DialogShell>
      </Section>

      <Section id="toast" title="Toast">
        <ToastRegion>
          <Toast message="Change saved" action={{ label: "Undo", onAction: () => {} }} durationMs={3_600_000} />
        </ToastRegion>
        <p className="text-ink2">The toast sits in the bottom-right region.</p>
      </Section>

      <Section id="layout" title="Layout">
        <TwoPane
          rail={
            <div data-testid="gallery-two-pane-rail">
              <SideRail title="Issues">
                <p className="text-ink2">3 blocking, 1 advisory.</p>
              </SideRail>
            </div>
          }
        >
          <div data-testid="gallery-two-pane-content">
            <PageSheet>
              <h3 className="text-ink font-semibold">Introduce New Words Using Morphemes</h3>
              <p className="text-ink">
                <strong>Say:</strong> &quot;Today we&apos;ll use word parts to unlock new words. The root mort- means
                death.&quot;
              </p>
              <p className="text-ink">
                <strong>Ask:</strong> &quot;If mort means death, what does immortal mean?&quot;
              </p>
            </PageSheet>
          </div>
        </TwoPane>
      </Section>
    </AppShell>
  );
}
