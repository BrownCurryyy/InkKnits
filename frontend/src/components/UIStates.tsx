type EmptyStateProps = {
  title: string;
  message: string;
  icon?: string;
};

export function CozySkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="animate-pulse space-y-4 rounded-cozy bg-white/70 p-5 shadow-cozy dark:bg-[#3a2d2d]/80" aria-label="Loading">
      <div className="h-6 w-40 rounded-full bg-accent/20" />
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="rounded-xl bg-background/60 p-4 dark:bg-[#4f3d3d]/60">
          <div className="h-4 w-2/5 rounded-full bg-text/10 dark:bg-textDark/15" />
          <div className="mt-3 h-3 w-4/5 rounded-full bg-text/10 dark:bg-textDark/15" />
        </div>
      ))}
    </div>
  );
}

export function CozyEmptyState({ title, message, icon = '✦' }: EmptyStateProps) {
  return (
    <div className="rounded-cozy border border-dashed border-accent/40 bg-accent/5 px-6 py-10 text-center dark:bg-accent/10">
      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-accent/20 text-2xl text-accent">{icon}</div>
      <p className="font-semibold">{title}</p>
      <p className="mx-auto mt-1 max-w-md text-sm text-text/65 dark:text-textDark/70">{message}</p>
    </div>
  );
}
