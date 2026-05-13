export function LoadingSection() {
  return (
    <div className="col-span-full flex items-center gap-3 my-5 pl-2.5 border-l-4 border-[var(--card-border)] text-[var(--text-muted)] text-[13px] italic">
      <div
        className="w-4 h-4 border-2 border-[var(--card-border)] rounded-full border-t-[var(--accent)]"
        style={{ animation: "spin 0.8s linear infinite" }}
      ></div>
      Loading streams...
    </div>
  );
}
