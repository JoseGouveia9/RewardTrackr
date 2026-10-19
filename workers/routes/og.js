const CRAWLERS =
  /whatsapp|facebookexternalhit|twitterbot|linkedinbot|telegrambot|slackbot|discordbot|pinterest|vkshare/i;

function escapeHtml(value) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Builds the minimal HTML with Open Graph tags that link-preview crawlers read. */
function ogHtml(rawAlias, id) {
  const alias = escapeHtml(rawAlias);
  const pageUrl = `https://rewardtrackr.com/view/${id}`;
  const title = `${alias}'s GoMining Rewards on RewardTrackr`;
  const description = `Check out ${alias}'s GoMining rewards records — Solo Mining, MinerWars, Bounties and more.`;
  const image = "https://rewardtrackr.com/og-preview.png";

  return `<!doctype html><html><head>
<meta charset="UTF-8">
<title>${title}</title>
<meta property="og:type" content="website">
<meta property="og:site_name" content="RewardTrackr">
<meta property="og:url" content="${pageUrl}">
<meta property="og:title" content="${title}">
<meta property="og:description" content="${description}">
<meta property="og:image" content="${image}">
<meta property="og:image:width" content="1280">
<meta property="og:image:height" content="800">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${title}">
<meta name="twitter:description" content="${description}">
<meta name="twitter:image" content="${image}">
<link rel="icon" type="image/webp" href="/logo.webp">
</head><body></body></html>`;
}

/**
 * Serves OG preview HTML for `/view/:id` to known crawlers only; browsers pass through to the SPA.
 * The alias comes from the shared profile on GitHub, falling back to one derived from the id.
 */
export async function handleOgRoute({ url, request }) {
  const match = url.pathname.match(/^\/view\/([a-z0-9_-]+)$/i);
  if (!match) return null;

  const userAgent = request.headers.get("User-Agent") ?? "";
  if (!CRAWLERS.test(userAgent)) return fetch(request);

  const id = match[1].toLowerCase().replace(/[^a-z0-9_-]/g, "");
  let alias = id
    .split(/[-_]/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");

  try {
    const rawUrl = `https://raw.githubusercontent.com/JoseGouveia9/rewardtrackr-shared/main/shared/${id}.json`;
    const response = await fetch(rawUrl, { headers: { "User-Agent": "RewardTrackr-OG/1.0" } });
    if (response.ok) {
      const data = await response.json();
      if (typeof data.alias === "string" && data.alias.trim()) alias = data.alias.trim();
    }
  } catch {}

  return new Response(ogHtml(alias, id), {
    headers: {
      "Content-Type": "text/html;charset=utf-8",
      "Cache-Control": "public,max-age=300",
    },
  });
}
