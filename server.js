import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import axios from 'axios';
import NodeCache from 'node-cache';

const app = express();
const cache = new NodeCache({ stdTTL: 60 }); // كاش لمدة دقيقة
const API_KEY = process.env.API_KEY;
const BASE_URL = 'https://v3.football.api-sports.io';
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Routes خاصة: يجب أن تكون معرفة قبل ال route العامة

app.get('/api/leagues/active', async (req, res) => {
  const cacheKey = 'leagues-active';
  if (cache.has(cacheKey)) return res.json(cache.get(cacheKey));

  try {
    const response = await axios.get(`${BASE_URL}/leagues?current=true`, {
      headers: { 'x-apisports-key': API_KEY }
    });
    cache.set(cacheKey, response.data);
    res.json(response.data);
  } catch (error) {
    res.status(500).json({ error: 'فشل جلب البطولات' });
  }
});

app.get('/api/teams/by-league', async (req, res) => {
  const { league, season } = req.query;
  if (!league || !season) return res.status(400).json({ error: 'حدد league و season' });

  const cacheKey = `teams-${league}-${season}`;
  if (cache.has(cacheKey)) return res.json(cache.get(cacheKey));

  try {
    const url = `${BASE_URL}/teams?league=${league}&season=${season}`;
    const response = await axios.get(url, {
      headers: { 'x-apisports-key': API_KEY }
    });
    cache.set(cacheKey, response.data);
    res.json(response.data);
  } catch (error) {
    res.status(500).json({ error: 'فشل جلب الفرق' });
  }
});

// Route عامة تدعم كل المسارات الأخرى بشكل صحيح
app.get('/api/*', async (req, res) => {
  const pathAfterApi = req.path.replace(/^\/api\//, ''); // كيجيب المسار كامل بعد /api/
  const query = req.originalUrl.split('?')[1] || '';
  const fullUrl = `${BASE_URL}/${pathAfterApi}?${query}`;
  const cacheKey = `${pathAfterApi}-${query}`;

  if (cache.has(cacheKey)) return res.json(cache.get(cacheKey));

  try {
    const response = await axios.get(fullUrl, {
      headers: { 'x-apisports-key': API_KEY }
    });
    cache.set(cacheKey, response.data);
    res.json(response.data);
  } catch (error) {
    console.error('API Error:', error.message);
    res.status(500).json({ error: 'فشل جلب البيانات من API-Football' });
  }
});

app.listen(PORT, () => {
  console.log(`Proxy server running on http://localhost:${PORT}`);
});
