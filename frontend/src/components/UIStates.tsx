type EmptyStateProps = {
  title: string;
  message: string;
  icon?: string;
};

export function CozySkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="panel-card animate-pulse space-y-4" aria-label="Loading">
      <div className="h-6 w-40 rounded-full bg-accentSecondary/30" />
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="rounded-xl bg-accentSecondary/10 p-4">
          <div className="h-4 w-2/5 rounded-full bg-text/10 dark:bg-textDark/15" />
          <div className="mt-3 h-3 w-4/5 rounded-full bg-text/10 dark:bg-textDark/15" />
        </div>
      ))}
    </div>
  );
}

export function CozyEmptyState({ title, message, icon = '✦' }: EmptyStateProps) {
  return (
    <div className="rounded-2xl border-2 border-dashed border-accentSecondary/40 bg-accentSecondary/5 px-6 py-10 text-center dark:bg-accentSecondary/10">
      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-accentSecondary/25 font-display text-2xl text-accentSecondary">{icon}</div>
      <p className="font-display text-lg font-bold lowercase">{title}</p>
      <p className="mx-auto mt-1 max-w-md text-sm text-text/65 dark:text-textDark/70">{message}</p>
    </div>
  );
}
