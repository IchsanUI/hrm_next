import { Construction, type LucideIcon } from "lucide-react";

import { Breadcrumb, type BreadcrumbItem } from "@/components/breadcrumb";
import { Card, CardContent } from "@/components/ui/card";

// Halaman placeholder buat menu yang masih blueprint (belum dikembangkan) —
// tetap muncul di navigasi supaya rencana modulnya kelihatan, tapi isinya
// cuma penjelasan cakupan + status "akan dikembangkan", bukan fitur aktif.
export function ModuleBlueprintPage({
  breadcrumbItems,
  title,
  description,
  icon: Icon,
  plannedFeatures,
}: {
  breadcrumbItems: BreadcrumbItem[];
  title: string;
  description: string;
  icon: LucideIcon;
  plannedFeatures: string[];
}) {
  return (
    <div>
      <Breadcrumb items={breadcrumbItems} />
      <div className="mb-6 flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
          <Icon className="size-5" />
        </span>
        <div>
          <h1 className="text-xl font-semibold sm:text-2xl">{title}</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
        </div>
      </div>

      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
          <span className="flex size-12 items-center justify-center rounded-full bg-amber-500/10 text-amber-600">
            <Construction className="size-6" />
          </span>
          <div>
            <p className="font-medium">Modul ini belum dikembangkan</p>
            <p className="mt-1 max-w-md text-sm text-muted-foreground">
              Masih berupa blueprint rencana pengembangan Payroll belum ada
              data/fitur aktif di sini.
            </p>
          </div>
          <div className="mt-4 w-full max-w-md text-left">
            <p className="mb-2 text-xs font-medium text-muted-foreground uppercase">
              Rencana fitur
            </p>
            <ul className="grid gap-1.5">
              {plannedFeatures.map((feature) => (
                <li key={feature} className="flex items-start gap-2 text-sm">
                  <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" />
                  {feature}
                </li>
              ))}
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
