type EmptyStateProps = {
  title: string;
  message: string;
  icon?: string;
};

export function CozySkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="animate-pulse overflow-hidden rounded-[18px] border border-[#eadfb7] bg-[#fffaf1]/90 p-5 shadow-[0_8px_20px_rgba(66,56,56,0.04)] dark:border-white/10 dark:bg-[#352d2d]/90" aria-label="Loading">
      <div className="h-5 w-36 rounded-full bg-accent/15" />
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="mt-4 rounded-[14px] border border-[#f0e5d4] bg-[#fdf6ea] p-4 dark:border-white/10 dark:bg-[#4a3c3c]/70">
          <div className="h-3.5 w-2/5 rounded-full bg-text/10 dark:bg-textDark/15" />
          <div className="mt-3 h-3 w-4/5 rounded-full bg-text/10 dark:bg-textDark/15" />
          <div className="mt-2 h-3 w-3/5 rounded-full bg-text/10 dark:bg-textDark/15" />
        </div>
      ))}
    </div>
  );
}

export function CozyEmptyState({ title, message, icon = '•' }: EmptyStateProps) {
  return (
    <div className="rounded-[18px] border border-dashed border-[#d7c0f0] bg-[#f8f0ff]/80 px-6 py-10 text-center transition-colors duration-200 dark:border-[#b69ae7]/40 dark:bg-[#43354a]/50">
      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-accent/15 text-sm font-semibold text-accent dark:text-[#f2e9ff]">
        {icon}
      </div>
      <p className="text-base font-semibold text-text dark:text-textDark">{title}</p>
      <p className="mx-auto mt-1 max-w-md text-sm leading-6 text-text/65 dark:text-textDark/70">{message}</p>
    </div>
  );
}
