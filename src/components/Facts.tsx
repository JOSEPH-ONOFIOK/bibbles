import { FACTS } from "@/lib/mochi";

// The collection at a glance, right under the hero
export function Facts() {
  return (
    <section data-bg="#fff1a8" aria-label="The collection" className="border-b-4 border-ink bg-[#fff1a8] px-4 py-6">
      <dl className="mx-auto grid max-w-5xl grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {FACTS.map((f) => (
          <div key={f.label} className="rounded-2xl border-4 border-ink bg-white px-3 py-2 text-center shadow-[3px_3px_0_#161616]">
            <dt className="text-xs font-extrabold text-ink/60">{f.label}</dt>
            <dd className="font-display text-2xl">{f.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
