import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import axios from 'axios';
import NodeCache from 'node-cache';

const app = express();
const cache = new NodeCache({ stdTTL: 60 });
const API_KEY = process.env.API_KEY;
const BASE_URL = 'https://v3.football.api-sports.io';
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.get('/api/:endpoint', async (req, res) => {
  const { endpoint } = req.params;
  const query = req.originalUrl.split('?')[1] || '';
  const fullUrl = `${BASE_URL}/${endpoint}?${query}`;
  const cacheKey = `${endpoint}-${query}`;

  if (cache.has(cacheKey)) {
    return res.json(cache.get(cacheKey));
  }

  try {
    const response = await axios.get(fullUrl, {
      headers: {
        'x-apisports-key': API_KEY
      }
    });

    cache.set(cacheKey, response.data);
    res.json(response.data);
  } catch (error) {
    console.error('API Error:', error.message);
    res.status(500).json({ error: 'Failed to fetch data from API-Football' });
  }
});

app.listen(PORT, () => {
  console.log(`Proxy server running on http://localhost:${PORT}`);
});

// ✅ بطولات حالية
app.get('/api/leagues/active', async (req, res) => {
  try {
    const response = await axios.get(`${BASE_URL}/leagues?current=true`, {
      headers: { 'x-apisports-key': API_KEY }
    });
    res.json(response.data);
  } catch (err) {
    res.status(500).json({ error: 'فشل جلب البطولات' });
  }
});

// ✅ فرق حسب البطولة والموسم
app.get('/api/teams/by-league', async (req, res) => {
  const { league, season } = req.query;
  if (!league || !season) return res.status(400).json({ error: 'حدد league و season' });

  try {
    const url = `${BASE_URL}/teams?league=${league}&season=${season}`;
    const response = await axios.get(url, {
      headers: { 'x-apisports-key': API_KEY }
    });
    res.json(response.data);
  } catch (err) {
    res.status(500).json({ error: 'فشل جلب الفرق' });
  }
});
