export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="px-4 pt-5 pb-3 md:px-8 md:pt-8 flex items-start justify-between gap-3">
      <div>
        <h1 className="text-xl md:text-2xl font-bold leading-tight">{title}</h1>
        {subtitle && <p className="text-muted text-sm mt-0.5">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}
