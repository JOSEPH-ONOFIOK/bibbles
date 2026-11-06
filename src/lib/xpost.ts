// Reads a public X post through X's public embed data (the source X's own embeds use).
// No API key needed, but it only sees public posts.

import { X_HANDLE } from "./mochi";

// Our X account, then the one we used before: posts tagging it still count
const US = [X_HANDLE.replace("@", "").toLowerCase(), "mochimochirh"];
const POST_LINK = /(?:https?:\/\/)?(?:www\.|mobile\.)?(?:x|twitter)\.com\/(\w{1,15})\/status(?:es)?\/(\d+)/i;

type PublicPost = { author: string; text: string; replyTo?: string; hasImage: boolean };
type Result = { ok: true; link: string } | { ok: false; error: string };

// The embed endpoint expects a token derived from the post id
const tokenFor = (id: string) => ((Number(id) / 1e15) * Math.PI).toString(36).replace(/(0+|\.)/g, "");

async function fetchPost(id: string): Promise<PublicPost | null> {
  const res = await fetch(`https://cdn.syndication.twimg.com/tweet-result?id=${id}&lang=en&token=${tokenFor(id)}`, {
    cache: "no-store",
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) return null;
  const j = await res.json().catch(() => null);
  if (!j?.user?.screen_name || typeof j.text !== "string") return null; // deleted, private or withheld
  const media = [...(j.mediaDetails ?? []), ...(j.photos ?? [])];
  return {
    author: String(j.user.screen_name),
    text: j.text,
    replyTo: j.in_reply_to_status_id_str ?? undefined,
    hasImage: media.length > 0,
  };
}

// Shared first steps: parse the link, load the post, check it's theirs
async function load(link: string, handle: string): Promise<{ post: PublicPost; id: string } | { ok: false; error: string }> {
  const m = POST_LINK.exec(link.trim());
  if (!m) return { ok: false, error: "Paste the link to your post. It looks like x.com/you/status/123…" };
  let post: PublicPost | null;
  try {
    post = await fetchPost(m[2]);
  } catch {
    return { ok: false, error: "We couldn't reach X just now. Try again in a minute." };
  }
  if (!post) return { ok: false, error: "We couldn't find that post. Make sure your account is public and the link is right." };
  if (post.author.toLowerCase() !== handle.toLowerCase()) {
    return { ok: false, error: `That post is from @${post.author}. Post from your own account, @${handle}.` };
  }
  return { post, id: m[2] };
}

const tagsAFriend = (text: string, handle: string) => {
  const skip = new Set([...US, handle.toLowerCase()]);
  return [...text.matchAll(/@(\w{1,15})/g)].some((t) => !skip.has(t[1].toLowerCase()));
};

// A reply directly under the pinned post that tags at least one friend
export async function verifyTagReply(link: string, handle: string, pinnedId: string): Promise<Result> {
  const r = await load(link, handle);
  if ("ok" in r) return r;
  if (r.post.replyTo !== pinnedId) return { ok: false, error: "That isn't a reply to our pinned post. Reply directly under it." };
  if (!tagsAFriend(r.post.text, handle)) return { ok: false, error: "Tag at least one friend in your reply." };
  return { ok: true, link: `https://x.com/${r.post.author}/status/${r.id}` };
}

// A post with their Mochi image that tags us and includes their wallet
export async function verifyMochiPost(link: string, handle: string, wallet: string): Promise<Result> {
  const r = await load(link, handle);
  if ("ok" in r) return r;
  const text = r.post.text.toLowerCase();
  if (!new RegExp(`@(${US.join("|")})\\b`).test(text)) return { ok: false, error: `Your post needs to tag ${X_HANDLE}.` };
  if (!text.includes(wallet.toLowerCase())) return { ok: false, error: "Your post needs to include the wallet you entered in step 4." };
  if (!r.post.hasImage) return { ok: false, error: "Attach your Mochi image to the post." };
  return { ok: true, link: `https://x.com/${r.post.author}/status/${r.id}` };
}
