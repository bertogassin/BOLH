const express = require('express');
const axios = require('axios');
const { createClient } = require('redis');

const app = express();
const PORT = process.env.PORT || 3100;

const TRANSLATIONS_BASE = process.env.TRANSLATIONS_BASE || 'https://s3.amazonaws.com/guardian-translations';
const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

let client;
(async () => {
  try {
    client = createClient({ url: redisUrl });
    await client.connect();
  } catch (e) {
    console.warn('Redis not available, cache disabled');
    client = null;
  }
})();

app.get('/:language.json', async (req, res) => {
  const language = req.params.language.replace(/[^a-z0-9_-]/gi, '') || 'en';
  const version = req.query.v || 'latest';
  const cacheKey = `translations:${language}:${version}`;

  if (client) {
    try {
      const cached = await client.get(cacheKey);
      if (cached) {
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Cache-Control', 'public, max-age=3600');
        return res.send(cached);
      }
    } catch (e) {
      // ignore
    }
  }

  try {
    const response = await axios.get(`${TRANSLATIONS_BASE}/${language}.json`, {
      timeout: 5000,
      validateStatus: (s) => s === 200,
    });
    const data = JSON.stringify(response.data);

    if (client) {
      try {
        await client.setEx(cacheKey, 3600, data);
      } catch (e) {
        // ignore
      }
    }

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.send(data);
  } catch (err) {
    if (language === 'en') {
      return res.status(500).json({ error: 'Translations unavailable' });
    }
    try {
      const fallback = await axios.get(`${TRANSLATIONS_BASE}/en.json`, { timeout: 5000 });
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Cache-Control', 'public, max-age=3600');
      res.send(JSON.stringify(fallback.data));
    } catch (e) {
      res.status(500).json({ error: 'Translations unavailable' });
    }
  }
});

app.post('/webhook', express.json(), async (req, res) => {
  const { language, version } = req.body || {};
  if (!client) return res.json({ success: true });

  try {
    if (language) await client.del(`translations:${language}:latest`);
    if (language && version) await client.del(`translations:${language}:${version}`);
  } catch (e) {
    // ignore
  }
  res.json({ success: true });
});

app.listen(PORT, () => {
  console.log(`Translations API listening on port ${PORT}`);
});
