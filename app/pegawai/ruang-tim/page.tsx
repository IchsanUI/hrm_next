import { auth } from "@/auth";
import {
  getTeamFeedPage,
  getMentionableNames,
  defaultFeedSinceDate,
} from "@/lib/team-feed";
import { TeamFeedContent } from "@/components/team-feed-content";

export default async function PegawaiRuangTimPage() {
  const session = await auth();
  const employeeId = session?.user.employeeId;
  const [{ rows, nextCursor }, mentionableNames] = employeeId
    ? await Promise.all([
        getTeamFeedPage(employeeId, null, 20, {
          sinceDate: defaultFeedSinceDate(),
        }),
        getMentionableNames(employeeId),
      ])
    : [{ rows: [], nextCursor: null }, []];

  return (
    <div className="mx-auto grid w-full max-w-2xl gap-4">
      <div>
        <h1 className="text-2xl font-semibold">Ruang Tim</h1>
        <p className="text-sm text-muted-foreground">
          Kabar terbaru izin/absensi rekan-rekan satu departemen.
        </p>
      </div>
      <TeamFeedContent
        initialRows={rows}
        initialCursor={nextCursor}
        mentionableNames={mentionableNames}
      />
    </div>
  );
}
