/**
 * task-prelaunch.md §B.2: a field real visitors never see or fill, so anything that does fill it is
 * automated. Off-screen (not `hidden`/`display:none`, which some bots skip) and out of the tab order; the
 * name ("company") is a plausible-looking bait for a generic form-filling bot, not literally "honeypot".
 */
export function HoneypotField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div aria-hidden="true" className="absolute left-[-9999px] top-auto h-px w-px overflow-hidden">
      <label htmlFor="company">Company</label>
      <input id="company" name="company" type="text" tabIndex={-1} autoComplete="off" value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
