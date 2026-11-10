import { GAME_OPEN_AT, BIOMES, CROPS, MATS, PROJECTS, SEASONS, TRIAL_BADGES, VILLAGERS, ZONES, type Mat } from "@/game/data";
import { FEATURED, TOKEN, X_HANDLE, X_URL } from "@/lib/mochi";
import { PeekMochi } from "../PeekMochi";
import { GameBackdrop } from "./GameBackdrop";
import { Countdown } from "../Countdown";

// The game's preview and docs, shown while it's closed. The lists read from the
// game's own data, so this page stays in step with the game.

const SECTIONS = [
  ["earn", "Play to earn"],
  ["how", "How to play"],
  ["world", "The world"],
  ["village", "Village"],
  ["grow", "Grow & craft"],
  ["frontier", "Frontier"],
  ["seasons", "Seasons"],
  ["trials", "Trials"],
  ["mochi", TOKEN],
  ["faq", "FAQ"],
] as const;

const SPLIT = [
  { label: "Burned forever", pct: 50, color: "#cf4f9c", icon: "🔥" },
  { label: "Community reward pool", pct: 40, color: "#3ecf6e", icon: "🎁" },
  { label: "Treasury", pct: 10, color: "#ffbe60", icon: "🏦" },
];

function Section({
  id,
  title,
  kicker,
  children,
  tint = "#fffaf3",
  peek,
}: {
  id: string;
  title: string;
  kicker?: string;
  children: React.ReactNode;
  tint?: string;
  // A Mochi peeking over the bottom edge
  peek?: { i: number; side: "left" | "right" };
}) {
  const p = peek && FEATURED[peek.i % FEATURED.length];
  return (
    <section id={id} className="dots relative scroll-mt-36 border-t-4 border-ink pt-16 sm:pt-20" style={{ backgroundColor: tint }}>
      <div className="mx-auto max-w-6xl px-4">
        {kicker && (
          <p className="inline-block -rotate-2 rounded-full border-[3px] border-ink bg-white px-4 py-1 font-display text-lg text-pink shadow-[3px_3px_0_#161616]">{kicker}</p>
        )}
        <h2 className="mt-3 font-display text-5xl leading-[0.95] text-white sm:text-7xl" style={{ textShadow: "4px 4px 0 #161616", WebkitTextStroke: "1.5px #161616" }}>
          {title}
        </h2>
        <div className="mt-8">{children}</div>
      </div>
      {p ? (
        <div className={`pointer-events-none mt-10 flex ${peek!.side === "left" ? "justify-start pl-[6%]" : "justify-end pr-[6%]"}`}>
          <div className="pointer-events-auto h-24 w-36 overflow-hidden sm:h-32 sm:w-48">
            <PeekMochi src={p.img} alt={p.name} rest="4%" burst="hearts" />
          </div>
        </div>
      ) : (
        <div className="h-16 sm:h-20" />
      )}
    </section>
  );
}

// A small live window into one corner of the game
function Window({ label, at, region, className = "" }: { label: string; at?: [number, number]; region?: number; className?: string }) {
  return (
    <div className={`chunk relative aspect-[16/10] overflow-hidden p-0 ${className}`}>
      <GameBackdrop at={at} region={region} />
      <p className="absolute top-3 left-3 rounded-full border-[3px] border-ink bg-white px-3 py-0.5 font-display text-sm">{label}</p>
    </div>
  );
}

// Sticker cards: a little tilt, and a wiggle on hover
const TILT = ["-rotate-1", "rotate-1", "rotate-0", "rotate-[1.5deg]", "-rotate-[1.5deg]"];
const Card = ({ children, className = "", i = 0 }: { children: React.ReactNode; className?: string; i?: number }) => (
  <div className={`rounded-3xl border-4 border-ink bg-white p-5 shadow-[5px_5px_0_#161616] transition duration-300 hover:-translate-y-1.5 hover:rotate-0 hover:shadow-[7px_9px_0_#161616] ${TILT[i % TILT.length]} ${className}`}>{children}</div>
);

export function GamePreview() {
  const crops = Object.keys(CROPS) as Mat[];
  return (
    <>
      {/* The game playing itself behind the title */}
      <section data-bg="#ccffb2" className="relative isolate h-[100svh] min-h-[560px] overflow-hidden">
        <GameBackdrop focus={{ wide: [0.5, 0.8], narrow: [0.5, 0.82] }} />
        {/* Mochis floating around the title */}
        {FEATURED.slice(0, 4).map((m, i) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={m.id}
            src={m.img}
            alt=""
            className="float pointer-events-none absolute hidden w-28 drop-shadow-[4px_5px_0_rgba(22,22,22,0.35)] md:block lg:w-36"
            style={{ ...[{ left: "8%", top: "20%" }, { right: "8%", top: "24%" }, { left: "12%", bottom: "12%" }, { right: "11%", bottom: "10%" }][i], animationDelay: `${i * -1.1}s` }}
          />
        ))}
        <div className="relative grid h-full place-items-center px-4 pt-16">
          <div className="pop-in max-w-xl rounded-[2rem] border-4 border-ink/80 bg-[#fffaf3]/65 px-6 py-8 text-center shadow-[6px_6px_0_rgba(22,22,22,0.6)] backdrop-blur-md sm:px-12">
            <p className="font-display text-lg text-pink">Welcome to</p>
            <h1 className="font-display text-6xl leading-none text-white sm:text-8xl" style={{ textShadow: "5px 5px 0 #161616" }}>
              Mochi Game
            </h1>
            <div className="mt-3 flex items-center justify-center gap-2">
              <span className="rounded-full border-[3px] border-ink bg-white px-3 py-0.5 font-display">V1</span>
              <span className="rounded-full border-[3px] border-ink bg-[#fff1a8] px-3 py-0.5 font-display shadow-[3px_3px_0_#161616]">Opens today 4:30pm WAT</span>
            </div>
            <Countdown className="mt-4" to={GAME_OPEN_AT} label="🎮 Opens in" done="Open now!" />
            <p className="mt-4 font-display text-2xl">Play to earn? Yes.</p>
            <p className="mt-2 font-semibold">A cosy adventure as your own Mochi: gather, farm, build the village, make friends and explore new worlds.</p>
            <div className="mt-5 flex flex-col items-center gap-2 sm:flex-row sm:justify-center">
              <a href={X_URL} target="_blank" rel="noreferrer" className="btn btn-pink px-6! py-2! text-lg!">
                Follow {X_HANDLE}
              </a>
              <a href="#earn" className="btn px-6! py-2! text-lg!">
                Read the docs ↓
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Docs menu that stays at the top while reading */}
      <nav className="sticky top-[84px] z-40 border-y-4 border-ink bg-[#fffaf3]/95 backdrop-blur" aria-label="Game docs">
        <div className="mx-auto flex max-w-6xl gap-1.5 overflow-x-auto px-4 py-2">
          {SECTIONS.map(([id, label]) => (
            <a key={id} href={`#${id}`} className="shrink-0 rounded-full border-[3px] border-ink bg-white px-3 py-1 font-display text-sm hover:bg-pink hover:text-white">
              {label}
            </a>
          ))}
        </div>
      </nav>

      <Section id="earn" peek={{ i: 0, side: "right" }} kicker="Play to earn? Yes." title={`Earn ${TOKEN} by playing well`} tint="#fff1a8">
        <div className="grid items-start gap-6 lg:grid-cols-2">
          <div className="space-y-4 text-lg font-semibold">
            <p>Win the weekly Trials, take part in events, finish the right requests, and {TOKEN} comes your way from the community reward pool.</p>
            <p>The pool isn&apos;t filled by printing new tokens. It&apos;s filled by the game itself: every {TOKEN} spent in Mochi is split on-chain.</p>
            <p className="text-base text-ink/70">Ordinary play earns XP, materials and coins. {TOKEN} rewards come from the pool, so what&apos;s available depends on how much is spent.</p>
          </div>
          <Card>
            <p className="font-display text-2xl">Every {TOKEN} spent</p>
            <div className="mt-4 flex h-10 overflow-hidden rounded-full border-4 border-ink">
              {SPLIT.map((s) => (
                <div key={s.label} style={{ width: `${s.pct}%`, background: s.color }} className="grid place-items-center font-display text-white" title={s.label}>
                  {s.pct}%
                </div>
              ))}
            </div>
            <ul className="mt-4 space-y-2">
              {SPLIT.map((s) => (
                <li key={s.label} className="flex items-center justify-between font-display text-xl">
                  <span>
                    {s.icon} {s.label}
                  </span>
                  <span>{s.pct}%</span>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-sm font-bold text-ink/60">Players who spend fill the pool. Players who play well earn from it. Every spend shrinks the supply.</p>
          </Card>
        </div>
      </Section>

      <Section id="how" peek={{ i: 1, side: "left" }} kicker="How to play" title="Walk, look, press" tint="#bfe3ff">
        <div className="grid gap-4 md:grid-cols-3">
          {[
            { k: "WASD", p: "Joystick", t: "Move", d: "Walk your Mochi around the world. Animals scurry away if you run at them." },
            { k: "E", p: "Tap the button", t: "Do", d: "Chop, mine, pick, fish, talk, plant, build. The button shows what you can do right now." },
            { k: "🌸", p: "Goals", t: "Plan", d: "Check the village, Bloom, Trials and your collection." },
          ].map((m, i) => (
            <Card key={m.t} i={i}>
              <div className="flex gap-2">
                <span className="rounded-xl border-[3px] border-ink bg-ink px-3 py-1 font-display text-lg text-white">{m.k}</span>
                <span className="rounded-xl border-[3px] border-ink bg-[#e2d4ff] px-3 py-1 font-display text-lg">{m.p}</span>
              </div>
              <p className="mt-3 font-display text-3xl">{m.t}</p>
              <p className="font-semibold text-ink/70">{m.d}</p>
            </Card>
          ))}
        </div>
        <p className="mt-5 font-semibold text-ink/70">
          Free to play in your browser, on desktop and phone. You play as the Mochi you design on the site. Energy refills over time, so a good day takes a few minutes, not hours.
        </p>
      </Section>

      <Section id="world" peek={{ i: 2, side: "right" }} kicker="The world" title="Start in Pocket Plaza" tint="#ccffb2">
        <div className="grid gap-4 md:grid-cols-3">
          <Window label="🌲 Whisper Woods" at={[12, 20]} />
          <Window label="🎣 Lily Pond" at={[30, 31.6]} />
          <Window label="🏡 Pocket Plaza" at={[30.5, 21.6]} />
        </div>
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {ZONES.filter((z) => z.id !== "home").map((z) => {
            const p = PROJECTS.find((x) => x.opens === z.id);
            return (
              <div key={z.id} className="rounded-2xl border-[3px] border-ink p-4" style={{ background: z.color }}>
                <p className="font-display text-2xl">{z.name}</p>
                <p className="text-2xl">{z.mats.map((m) => MATS[m].icon).join(" ")}</p>
                <p className="mt-1 text-sm font-bold text-ink/70">{p ? `Opens when you build the ${p.name} ${p.icon}` : "Open from the start"}</p>
              </div>
            );
          })}
        </div>
      </Section>

      <Section id="village" peek={{ i: 3, side: "left" }} kicker="Build up the village" title="Every building brings a neighbour" tint="#ffc6d6">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {PROJECTS.map((p, i) => (
            <Card key={p.id} i={i} className="p-4!">
              <p className="text-4xl">{p.icon}</p>
              <p className="mt-1 font-display text-2xl">{p.name}</p>
              <p className="text-sm font-semibold text-ink/70">{p.perk}</p>
              {p.villager !== undefined && (
                <p className="mt-2 font-display">
                  {VILLAGERS[p.villager].icon} {VILLAGERS[p.villager].name} moves in
                </p>
              )}
            </Card>
          ))}
        </div>
        <p className="mt-5 font-semibold text-ink/70">
          Gather wood, stone, cotton and coins and put them in bit by bit. Villagers wander to their favourite spots, ask for help each day and love certain gifts. Hearts unlock new recipes and outfits.
        </p>
      </Section>

      <Section id="grow" peek={{ i: 4, side: "right" }} kicker="Grow, craft and decorate" title="Make your Pocket yours" tint="#ffe5b4">
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <p className="font-display text-2xl">🌱 Garden</p>
            <p className="font-semibold text-ink/70">Plant, water, come back when it&apos;s grown. Rainy days water it for you.</p>
            <p className="mt-2 text-3xl">{crops.map((c) => MATS[c].icon).join(" ")}</p>
          </Card>
          <Card>
            <p className="font-display text-2xl">🔨 Workbench</p>
            <p className="font-semibold text-ink/70">Craft furniture and outfits. What you craft for your Mochi, it wears.</p>
            <p className="mt-2 text-3xl">🛋️ 🧸 💡 🧥 👑</p>
          </Card>
          <Card>
            <p className="font-display text-2xl">🏡 Your Pocket</p>
            <p className="font-semibold text-ink/70">Decorate your home, visit other players&apos; Pockets and vote for Pocket of the week 👑</p>
          </Card>
        </div>
      </Section>

      <Section id="frontier" peek={{ i: 5, side: "left" }} kicker="A world that keeps going" title="Carve a path to new worlds" tint="#e2d4ff">
        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
          <div>
            <p className="text-lg font-semibold">
              Past the woods there&apos;s an overgrown trail. Gather what it takes to carve a path through and a new world opens, each with its own look, wildlife and treasure, and another trail onward. Then the worlds come round again, richer each time.
            </p>
            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
              {BIOMES.map((b, i) => (
                <div key={b.id} className="rounded-2xl border-[3px] border-ink p-3" style={{ background: b.ground[0], color: b.id === "star" || b.id === "grove" ? "#fff" : undefined }}>
                  <p className="text-2xl">{MATS[b.mat].icon}</p>
                  <p className="font-display text-lg leading-tight">
                    {i + 1}. {b.name}
                  </p>
                </div>
              ))}
              <div className="grid place-items-center rounded-2xl border-[3px] border-dashed border-ink p-3 font-display text-lg">∞ and on…</div>
            </div>
          </div>
          <Window label="🧊 Frost Peaks" region={1} />
        </div>
      </Section>

      <Section id="seasons" peek={{ i: 6, side: "right" }} kicker="A living world" title="Seasons, weather and festivals" tint="#bfe3ff">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {Object.values(SEASONS).map((s, i) => (
            <Card key={s.name} i={i} className="p-4!">
              <p className="text-4xl">{s.icon}</p>
              <p className="font-display text-2xl">{s.name}</p>
              <p className="text-sm font-semibold text-ink/70">
                Crops: {s.crops.map((c) => MATS[c].icon).join(" ")} · Fish: {s.fish.join(", ")}
              </p>
              <p className="mt-2 font-display">🎉 {s.festival}</p>
            </Card>
          ))}
        </div>
        <p className="mt-5 font-semibold text-ink/70">A new season every week. Rain waters your crops, winter brings snow, and the light shifts from day to night. Festivals double coins and hearts.</p>
      </Section>

      <Section id="trials" peek={{ i: 7, side: "left" }} kicker="Earn it" title="Weekly Trials" tint="#fff1a8">
        <div className="grid items-start gap-6 md:grid-cols-2">
          <p className="text-lg font-semibold">
            Every week a new 90-second skill challenge: catch the most fish, chop the most wood, pick the most flowers. The best players win badges and {TOKEN} from the reward pool. Paying never decides who wins.
          </p>
          <div className="flex gap-3">
            {TRIAL_BADGES.map((b, i) => (
              <Card key={b.name} i={i} className="flex-1 p-4! text-center">
                <p className="text-5xl">{b.icon}</p>
                <p className="font-display text-xl">{b.name}</p>
                <p className="text-sm font-bold text-ink/60">{b.at}+ in a run</p>
              </Card>
            ))}
          </div>
        </div>
      </Section>

      <Section id="mochi" peek={{ i: 8, side: "right" }} kicker="Optional, and burned when you spend it" title={`Spend ${TOKEN} to go further`} tint="#ffc6d6">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[
            ["⚡", "Skip a wait or refill your energy"],
            ["🌱", "More garden plots and workbench slots"],
            ["🏡", "A bigger Pocket"],
            ["🎁", "Rare seeds, outfits and festival items"],
            ["🌸", "Bloom: your Mochi's next form"],
            ["🏆", "Trial entries"],
          ].map(([icon, t], i) => (
            <Card key={t} i={i} className="flex items-center gap-3 p-4!">
              <span className="text-4xl">{icon}</span>
              <span className="font-display text-xl">{t}</span>
            </Card>
          ))}
        </div>
        <p className="mt-5 font-display text-2xl">Everything basic stays free. Every {TOKEN} spent: 50% burned · 40% back to players · 10% treasury.</p>
      </Section>

      <Section id="faq" kicker="Questions" title="FAQ" tint="#ccffb2">
        <div className="grid gap-3 md:grid-cols-2">
          {[
            ["Is it free?", `Yes. Everything basic is free to play. ${TOKEN} is optional.`],
            ["When can I play?", `Soon. Follow ${X_HANDLE} to hear the moment it opens.`],
            ["Do I need a wallet?", "Not to play. Connecting your X saves your progress online so it follows you."],
            ["Does it work on my phone?", "Yes, in your browser, with a joystick and a tap button. No download."],
            [`How do I earn ${TOKEN}?`, "By winning Trials and events, paid from the community reward pool. Earnings aren't guaranteed and depend on the pool."],
            ["Which Mochi do I play as?", "The one you design on the site. Crafted outfits show on it in the game."],
          ].map(([q, a], i) => (
            <Card key={q} i={i}>
              <p className="font-display text-2xl">{q}</p>
              <p className="mt-1 font-semibold text-ink/70">{a}</p>
            </Card>
          ))}
        </div>
        <div className="mt-10 text-center">
          <p className="font-display text-4xl">Mochi Game V1 opens today 🩷</p>
          <Countdown className="mt-4" to={GAME_OPEN_AT} label="🎮 Opens in" done="Open now!" />
          <a href={X_URL} target="_blank" rel="noreferrer" className="btn btn-pink mt-4 px-8! py-3! text-xl!">
            Follow {X_HANDLE}
          </a>
          <p className="mt-3 font-bold text-ink/60">Free mint, powered by {TOKEN}.</p>
        </div>
      </Section>
    </>
  );
}
