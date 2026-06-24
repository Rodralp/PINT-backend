import { adminBadgeService } from '../services/adminBadgeService.js';

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

export const getShareBadge = async (req, res) => {
  const badgeId = Number(req.params?.badgeId);

  if (!Number.isInteger(badgeId) || badgeId <= 0) {
    res.status(400).send('Invalid badge id.');
    return;
  }

  try {
    const badge = await adminBadgeService.getBadge(badgeId);

    if (!badge) {
      res.status(404).send('Badge not found.');
      return;
    }

    const badgeName = badge.name || '';
    const levelTitle = badge.levelTitle || badge.typeName || '';
    const description = badge.description || `Badge ${levelTitle} - ${badge.points || 0} pontos`;
    const imageUrl = badge.badgeImage || null;
    const shareUrl = `${FRONTEND_URL}/galeria-publica/badge/${badgeId}`;

    const html = `<!doctype html>
<html lang="pt">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />

    <title>${badgeName} - Badge | Softinsa</title>

    <meta property="og:title" content="${badgeName} - Badge" />
    <meta property="og:description" content="${description}" />
    <meta property="og:image" content="${imageUrl}" />
    <meta property="og:url" content="${shareUrl}" />
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="Softinsa Badge Platform" />

    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${badgeName} - Badge" />
    <meta name="twitter:description" content="${description}" />
    <meta name="twitter:image" content="${imageUrl}" />

    <meta http-equiv="refresh" content="0;url=${shareUrl}" />
    <link rel="canonical" href="${shareUrl}" />
  </head>
  <body>
    <p>A redirecionar para <a href="${shareUrl}">${badgeName}</a>...</p>
    <script>window.location.href = ${JSON.stringify(shareUrl)};</script>
  </body>
</html>`;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.status(200).send(html);
  } catch (error) {
    res.status(500).send('Internal server error.');
  }
};
