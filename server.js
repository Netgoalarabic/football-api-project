import dotenv from 'dotenv';
dotenv.config();
import moment from 'moment-timezone';
import express from 'express';
import axios from 'axios';
import NodeCache from 'node-cache';
import cors from 'cors';

const app = express();

app.use(cors());
app.use(express.json());

// إضافة تقديم الملفات الثابتة من مجلد public
app.use(express.static('public'));

const cache = new NodeCache({ stdTTL: 43200 }); // كاش 12 ساعة
const API_KEY = process.env.API_KEY;
const BASE_URL = 'https://v3.football.api-sports.io';
const PORT = process.env.PORT || 3001;

/** دالة جلب البيانات مع الكاش */
const fetchFromApi = async (url, cacheKey, res, customError = 'فشل جلب البيانات') => {
  try {
    if (cache.has(cacheKey)) {
      console.log(`✅ [CACHE] ${cacheKey}`);
      return res.json(cache.get(cacheKey));
    }
    console.log(`🌐 [FETCH] ${url}`);
    const response = await axios.get(url, {
      headers: { 'x-apisports-key': API_KEY }
    });
    cache.set(cacheKey, response.data);
    res.json(response.data);
  } catch (error) {
    console.error('❌ API Error:', error.message);
    res.status(500).json({ error: customError });
  }
};

/** ✅ صفحة الفحص */
app.get('/', (req, res) => {
  res.send('✅ الخادم شغال!');
});

/** ✅ مباريات اليوم */
app.get('/api/fixtures/today', async (req, res) => {
  const today = moment().tz('Africa/Casablanca').format('YYYY-MM-DD');
  const url = `${BASE_URL}/fixtures?date=${today}`;
  await fetchFromApi(url, `fixtures-today-${today}`, res, 'فشل جلب مباريات اليوم');
});

/** ✅ مباريات الغد */
app.get('/api/fixtures/tomorrow', async (req, res) => {
  const tomorrow = moment().tz('Africa/Casablanca').add(1, 'day').format('YYYY-MM-DD');
  const url = `${BASE_URL}/fixtures?date=${tomorrow}`;
  await fetchFromApi(url, `fixtures-tomorrow-${tomorrow}`, res, 'فشل جلب مباريات الغد');
});

/** ✅ المباريات المباشرة */
app.get('/api/fixtures/live', async (req, res) => {
  const url = `${BASE_URL}/fixtures?live=all`;
  await fetchFromApi(url, 'fixtures-live', res, 'فشل جلب المباريات المباشرة');
});

/** ✅ بطولات حالية */
app.get('/api/leagues/active', async (req, res) => {
  const url = `${BASE_URL}/leagues?current=true`;
  await fetchFromApi(url, 'leagues-active', res, 'فشل جلب البطولات');
});

/** ✅ جميع البطولات */
app.get('/api/leagues', async (req, res) => {
  const url = `${BASE_URL}/leagues`;
  await fetchFromApi(url, 'leagues-all', res, 'فشل جلب البطولات');
});

/** ✅ فرق دوري */
app.get('/api/teams/by-league', async (req, res) => {
  const { league, season } = req.query;
  if (!league || !season) return res.status(400).json({ error: 'حدد league و season' });
  const url = `${BASE_URL}/teams?league=${league}&season=${season}`;
  await fetchFromApi(url, `teams-${league}-${season}`, res, 'فشل جلب الفرق');
});

/** ✅ تفاصيل مباراة */
app.get('/api/fixtures/:id', async (req, res) => {
  const { id } = req.params;
  const url = `${BASE_URL}/fixtures?id=${id}`;
  await fetchFromApi(url, `fixture-${id}`, res, 'فشل جلب تفاصيل المباراة');
});

/** ✅ ترتيب الدوري */
app.get('/api/standings', async (req, res) => {
  const { league, season } = req.query;
  if (!league || !season) return res.status(400).json({ error: 'حدد league و season' });
  const url = `${BASE_URL}/standings?league=${league}&season=${season}`;
  await fetchFromApi(url, `standings-${league}-${season}`, res, 'فشل جلب الترتيب');
});

/** ✅ هدافو الدوري */
app.get('/api/topscorers', async (req, res) => {
  const { league, season } = req.query;
  if (!league || !season) return res.status(400).json({ error: 'حدد league و season' });
  const url = `${BASE_URL}/players/topscorers?league=${league}&season=${season}`;
  await fetchFromApi(url, `topscorers-${league}-${season}`, res, 'فشل جلب الهدافين');
});

/** ✅ لاعبو فريق */
app.get('/api/players/by-team', async (req, res) => {
  const { team, season } = req.query;
  if (!team || !season) return res.status(400).json({ error: 'حدد team و season' });
  const url = `${BASE_URL}/players?team=${team}&season=${season}`;
  await fetchFromApi(url, `players-${team}-${season}`, res, 'فشل جلب اللاعبين');
});

/** ✅ تفاصيل لاعب */
app.get('/api/player/:id', async (req, res) => {
  const { id } = req.params;
  const url = `${BASE_URL}/players?id=${id}`;
  await fetchFromApi(url, `player-${id}`, res, 'فشل جلب تفاصيل اللاعب');
});

/** ✅ مباريات فريق */
app.get('/api/fixtures/by-team', async (req, res) => {
  const { team, season } = req.query;
  if (!team || !season) return res.status(400).json({ error: 'حدد team و season' });
  const url = `${BASE_URL}/fixtures?team=${team}&season=${season}`;
  await fetchFromApi(url, `fixtures-team-${team}-${season}`, res, 'فشل جلب مباريات الفريق');
});

/** ✅ روت عام (يُفضل يكون آخر واحد) */
app.get('/api/*', async (req, res) => {
  const pathAfterApi = req.path.replace(/^\/api\//, '');
  const query = req.originalUrl.split('?')[1] || '';
  const fullUrl = `${BASE_URL}/${pathAfterApi}?${query}`;
  await fetchFromApi(fullUrl, `${pathAfterApi}-${query}`, res, 'فشل جلب البيانات من API-Football');
});

/** 🚀 بدء الخادم */
app.listen(PORT, () => {
  console.log(`🚀 الخادم يعمل على http://localhost:${PORT}`);
});
