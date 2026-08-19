"use client";

import { useSession } from "@/lib/auth/RoleContext";
import { BackLink } from "@/components/BackLink";
import { PageHeader } from "@/components/PageHeader";
import { Bi } from "@/components/Bi";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { CHANGELOG } from "@/lib/changelog";

function ChangelogContent() {
  const { session } = useSession();
  if (!session) return null;

  return (
    <div className="pb-10">
      <BackLink href="/more" label="More · Thêm" />
      <PageHeader title="What's New · Có Gì Mới" subtitle="Version history · Lịch sử phiên bản" />
      <div className="px-4 md:px-8 space-y-3">
        {CHANGELOG.map((entry) => (
          <Card key={entry.version}>
            <div className="flex items-center justify-between gap-2 mb-2">
              <Badge tone="muted">v{entry.version}</Badge>
              <span className="text-xs text-muted">{entry.date}</span>
            </div>
            <ul className="list-disc pl-4 space-y-2">
              {entry.changes.map((change, i) => (
                <li key={i}>
                  <Bi value={change} className="text-sm" />
                </li>
              ))}
            </ul>
          </Card>
        ))}
      </div>
    </div>
  );
}

export default function ChangelogPage() {
  return <ChangelogContent />;
}
