// A floating gradient: soft blobs in the site's colors drifting behind the page.

const BLOBS = [
  { c: "#cf4f9c", left: "-25%", top: "-30%", x: "18vw", y: "14vh", d: "19s" },
  { c: "#ccffb2", left: "45%", top: "-35%", x: "-22vw", y: "20vh", d: "23s" },
  { c: "#fff1a8", left: "65%", top: "30%", x: "-18vw", y: "-16vh", d: "17s" },
  { c: "#bfe3ff", left: "-30%", top: "35%", x: "24vw", y: "-12vh", d: "21s" },
  { c: "#ffc6d6", left: "20%", top: "55%", x: "14vw", y: "-24vh", d: "25s" },
  { c: "#e2d4ff", left: "10%", top: "5%", x: "-10vw", y: "12vh", d: "15s" },
  { c: "#ffe5b4", left: "70%", top: "70%", x: "-26vw", y: "-10vh", d: "27s" },
];

export function Mesh() {
  return (
    <div className="mesh" aria-hidden>
      {BLOBS.map((b) => (
        <span
          key={b.c}
          style={{ left: b.left, top: b.top, "--c": b.c, "--x": b.x, "--y": b.y, "--d": b.d } as React.CSSProperties}
        />
      ))}
    </div>
  );
}
