import { Card, CardHeader } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/States";
import { EmptyState } from "@/components/ui/States";

export function ChartCard({
  title,
  subtitle,
  icon,
  action,
  chartType,
  data,
  loading = false,
  isEmpty,
  emptyTitle = "No data to display",
  legend,
  children,
  className,
  height = 240,
}: {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  chartType?: "line" | "bar" | "donut" | "area";
  data?: object[];
  loading?: boolean;
  isEmpty?: boolean;
  emptyTitle?: string;
  legend?: boolean;
  children: React.ReactNode;
  className?: string;
  height?: number | string;
}) {
  const resolvedEmpty = isEmpty ?? (data !== undefined && data.length === 0);
  return (
    <Card className={className}>
      <CardHeader title={title} subtitle={subtitle} icon={icon} action={action} />
      {loading ? (
        <Skeleton variant="chart" height={typeof height === "number" ? height : 240} />
      ) : resolvedEmpty ? (
        <EmptyState title={emptyTitle} />
      ) : (
        <>
          <div style={{ height }}>{children}</div>
          {legend && chartType && (
            <p className="mt-2 text-center text-[10px] uppercase tracking-wide text-text-muted">
              {chartType} chart
            </p>
          )}
        </>
      )}
    </Card>
  );
}
