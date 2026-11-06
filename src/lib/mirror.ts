import { after } from "next/server";
import { signupRow, type Entry, type RowStats, type SignupRow } from "./entry";

// Sends every sign-up to a Google Sheet (scripts/apps-script/README.md).
// Each save sends the whole row, so the next save repairs a failed one.
const URL_ = process.env.GOOGLE_SHEETS_WEBAPP_URL;

async function send(row: SignupRow) {
  const res = await fetch(URL_!, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "bulk", rows: [row] }),
    redirect: "follow",
    cache: "no-store",
    signal: AbortSignal.timeout(25_000),
  });
  if (!res.ok) throw new Error(`Sheets web app returned ${res.status}`);
  const data = await res.json();
  if (data.error) throw new Error(`Sheets web app: ${data.error}`);
}

// Runs after the response, so a slow sheet never slows a visitor down.
export function queueMirror(entry: Entry, stats?: RowStats) {
  if (!URL_) return;
  const row = signupRow(entry, stats); // copy now: the entry can change later in the request
  after(() => send(row).catch((e) => console.error("Sheet copy failed", row.handle, e)));
}
