export function OmissionAlert({ text }: { text: string }) {
  return (
    <div className="flex items-start gap-2 rounded-lg bg-amber-950/30 border border-amber-900/20 px-3 py-2">
      <span className="shrink-0 mt-0.5 text-amber-500 text-sm font-bold">!</span>
      <p className="text-sm text-amber-200/80 leading-relaxed">{text}</p>
    </div>
  );
}
