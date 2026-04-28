const CRAWLERS =
  /whatsapp|facebookexternalhit|twitterbot|linkedinbot|telegrambot|slackbot|discordbot|pinterest|vkshare/i;

function ogHtml(alias, id) {
  const pageUrl = `https://rewardtrackr.com/view/${id}`;
  const title = `${alias}'s records on RewardTrackr`;
  const description = `Check out ${alias}'s GoMining Solo Mining, MinerWars and reward data.`;
  const image = "https://rewardtrackr.com/logo.webp";

  return `<!doctype html><html><head>
<meta charset="UTF-8">
<title>${title}</title>
<meta property="og:type" content="website">
<meta property="og:site_name" content="RewardTrackr">
<meta property="og:url" content="${pageUrl}">
<meta property="og:title" content="${title}">
<meta property="og:description" content="${description}">
<meta property="og:image" content="${image}">
<meta property="og:image:width" content="512">
<meta property="og:image:height" content="512">
<meta name="twitter:card" content="summary">
<meta name="twitter:title" content="${title}">
<meta name="twitter:description" content="${description}">
<meta name="twitter:image" content="${image}">
<link rel="icon" type="image/webp" href="/logo.webp">
</head><body></body></html>`;
}

export async function handleOgRoute({ url, request, env }) {
  const match = url.pathname.match(/^\/view\/([a-z0-9_-]+)$/i);
  if (!match) return null;

  const ua = request.headers.get("User-Agent") ?? "";
  if (!CRAWLERS.test(ua)) return null;

  const id = match[1].toLowerCase().replace(/[^a-z0-9_-]/g, "");
  let alias = id;

  try {
    const workerUrl = env.WORKER_URL ?? `https://${url.host}`;
    const res = await fetch(`${workerUrl}/share/${id}`, {
      headers: { "User-Agent": "RewardTrackr-OG/1.0" },
    });
    if (res.ok) {
      const data = await res.json();
      if (typeof data.alias === "string") alias = data.alias;
    }
  } catch {
    // fall back to id as alias
  }

  return new Response(ogHtml(alias, id), {
    headers: {
      "Content-Type": "text/html;charset=utf-8",
      "Cache-Control": "public,max-age=300",
    },
  });
}
