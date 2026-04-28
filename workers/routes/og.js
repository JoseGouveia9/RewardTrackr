const CRAWLERS =
  /whatsapp|facebookexternalhit|twitterbot|linkedinbot|telegrambot|slackbot|discordbot|pinterest|vkshare/i;

function ogHtml(alias, id) {
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

export async function handleOgRoute({ url, request }) {
  const match = url.pathname.match(/^\/view\/([a-z0-9_-]+)$/i);
  if (!match) return null;

  const ua = request.headers.get("User-Agent") ?? "";
  if (!CRAWLERS.test(ua)) return fetch(request);

  const id = match[1].toLowerCase().replace(/[^a-z0-9_-]/g, "");
  // Best-effort capitalisation fallback: "moustachio" → "Moustachio", "my-alias" → "My Alias"
  let alias = id
    .split(/[-_]/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");

  try {
    const rawUrl = `https://raw.githubusercontent.com/JoseGouveia9/rewardtrackr-shared/main/shared/${id}.json`;
    const res = await fetch(rawUrl, { headers: { "User-Agent": "RewardTrackr-OG/1.0" } });
    if (res.ok) {
      const data = await res.json();
      if (typeof data.alias === "string" && data.alias.trim()) alias = data.alias.trim();
    }
  } catch {
    // use capitalised fallback
  }

  return new Response(ogHtml(alias, id), {
    headers: {
      "Content-Type": "text/html;charset=utf-8",
      "Cache-Control": "public,max-age=300",
    },
  });
}
