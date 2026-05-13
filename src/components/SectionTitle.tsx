interface SectionTitleProps {
  title: string;
}

export function SectionTitle({ title }: SectionTitleProps) {
  return (
    <div className="text-sm font-bold uppercase tracking-[1px] my-[30px] mb-4 pl-2.5 border-l-4 border-[var(--accent)] text-[#9fb3ff] clear-both col-span-full">
      {title}
    </div>
  );
}
