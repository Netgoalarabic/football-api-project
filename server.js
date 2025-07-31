import dotenv from 'dotenv';
dotenv.config();

import moment from 'moment-timezone';
import express from 'express';
import axios from 'axios';
import NodeCache from 'node-cache';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import Parser from 'rss-parser';

const app = express();

// 🛡️ إعدادات الحماية
app.use(helmet());
app.use(cors({ origin: '*' })); // ممكن تخصيص الدومين هنا
app.use(express.json());
app.use(express.static('public'));

// 🛡️ تحديد معدل الطلبات (كل IP: 100 طلب في الساعة)
const limiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 ساعة
  max: 100,
  message: '❌ تم تجاوز عدد الطلبات المسموح بها. حاول لاحقًا.',
});
app.use(limiter); // مهم: تفعيل limiter قبل تعريف المسارات

const API_KEY = process.env.API_KEY;
const BASE_URL = 'https://v3.football.api-sports.io';
const PORT = process.env.PORT || 3001;

const cache = new NodeCache({ stdTTL: 43200 }); // 12 ساعة كاش
const parser = new Parser();

// دالة لجلب البيانات مع الكاش من API-Football
const fetchFromApi = async (url, cacheKey, res, customError = 'فشل جلب البيانات') => {
  try {
    if (cache.has(cacheKey)) return res.json(cache.get(cacheKey));
    const response = await axios.get(url, {
      headers: { 'x-apisports-key': API_KEY },
      timeout: 10000,
    });
    cache.set(cacheKey, response.data);
    return res.json(response.data);
  } catch (error) {
    console.error('❌ API Error:', error.message);
    return res.status(500).json({ error: customError });
  }
};

// صفحة فحص السيرفر
app.get('/', (req, res) => res.send('✅ Net Goal Arabic Server شغال!'));

/* === مسارات API-Football === */

// 1. المواسم
app.get('/api/seasons', async (req, res) => {
  const url = `${BASE_URL}/leagues/seasons`;
  await fetchFromApi(url, 'seasons', res, 'فشل جلب المواسم');
});

// 2. الدول
app.get('/api/countries', async (req, res) => {
  const url = `${BASE_URL}/countries`;
  await fetchFromApi(url, 'countries', res, 'فشل جلب الدول');
});

// 3. البطولات
app.get('/api/leagues', async (req, res) => {
  const url = `${BASE_URL}/leagues`;
  await fetchFromApi(url, 'leagues', res, 'فشل جلب البطولات');
});

app.get('/api/leagues/active', async (req, res) => {
  const url = `${BASE_URL}/leagues?current=true`;
  await fetchFromApi(url, 'leagues-active', res, 'فشل جلب البطولات الحالية');
});

// 4. المباريات
app.get('/api/fixtures/today', async (req, res) => {
  const today = moment().tz('Africa/Casablanca').format('YYYY-MM-DD');
  const url = `${BASE_URL}/fixtures?date=${today}`;
  await fetchFromApi(url, `fixtures-today-${today}`, res, 'فشل جلب مباريات اليوم');
});

app.get('/api/fixtures/tomorrow', async (req, res) => {
  const tomorrow = moment().tz('Africa/Casablanca').add(1, 'day').format('YYYY-MM-DD');
  const url = `${BASE_URL}/fixtures?date=${tomorrow}`;
  await fetchFromApi(url, `fixtures-tomorrow-${tomorrow}`, res, 'فشل جلب مباريات الغد');
});

app.get('/api/fixtures/live', async (req, res) => {
  const url = `${BASE_URL}/fixtures?live=all`;
  await fetchFromApi(url, 'fixtures-live', res, 'فشل جلب المباريات المباشرة');
});

// مباريات سابقة
app.get('/api/fixtures/previous', async (req, res) => {
  const url = `${BASE_URL}/fixtures?last=20`;
  await fetchFromApi(url, 'fixtures-previous', res, 'فشل جلب المباريات السابقة');
});

// مباريات قادمة
app.get('/api/fixtures/next', async (req, res) => {
  const url = `${BASE_URL}/fixtures?next=20`;
  await fetchFromApi(url, 'fixtures-next', res, 'فشل جلب المباريات القادمة');
});

// مباريات بتاريخ مخصص
app.get('/api/fixtures/date/:date', async (req, res) => {
  const { date } = req.params;
  const url = `${BASE_URL}/fixtures?date=${date}`;
  await fetchFromApi(url, `fixtures-date-${date}`, res, 'فشل جلب المباريات بتاريخ مخصص');
});

app.get('/api/fixtures/:id', async (req, res) => {
  const { id } = req.params;
  const url = `${BASE_URL}/fixtures?id=${id}`;
  await fetchFromApi(url, `fixture-${id}`, res, 'فشل جلب تفاصيل المباراة');
});

app.get('/api/h2h', async (req, res) => {
  const { h2h } = req.query;
  if (!h2h) return res.status(400).json({ error: 'حدد h2h=homeID-awayID' });
  const url = `${BASE_URL}/fixtures/headtohead?h2h=${h2h}`;
  await fetchFromApi(url, `h2h-${h2h}`, res, 'فشل جلب المواجهات');
});

app.get('/api/fixtures/:id/events', async (req, res) => {
  const url = `${BASE_URL}/fixtures/events?fixture=${req.params.id}`;
  await fetchFromApi(url, `fixture-events-${req.params.id}`, res, 'فشل جلب أحداث المباراة');
});

app.get('/api/fixtures/:id/lineups', async (req, res) => {
  const url = `${BASE_URL}/fixtures/lineups?fixture=${req.params.id}`;
  await fetchFromApi(url, `fixture-lineups-${req.params.id}`, res, 'فشل جلب تشكيلات المباراة');
});

app.get('/api/fixtures/:id/statistics', async (req, res) => {
  const url = `${BASE_URL}/fixtures/statistics?fixture=${req.params.id}`;
  await fetchFromApi(url, `fixture-stats-${req.params.id}`, res, 'فشل جلب إحصائيات المباراة');
});

app.get('/api/injuries', async (req, res) => {
  const { league, season } = req.query;
  const url = `${BASE_URL}/injuries?league=${league}&season=${season}`;
  await fetchFromApi(url, `injuries-${league}-${season}`, res, 'فشل جلب الإصابات');
});

app.get('/api/fixtures/:id/predictions', async (req, res) => {
  const url = `${BASE_URL}/predictions?fixture=${req.params.id}`;
  await fetchFromApi(url, `predictions-${req.params.id}`, res, 'فشل جلب توقعات المباراة');
});

// 5. الفرق
app.get('/api/teams/by-league', async (req, res) => {
  const { league, season } = req.query;
  const url = `${BASE_URL}/teams?league=${league}&season=${season}`;
  await fetchFromApi(url, `teams-${league}-${season}`, res, 'فشل جلب الفرق');
});

app.get('/api/teams/statistics', async (req, res) => {
  const { team, league, season } = req.query;
  const url = `${BASE_URL}/teams/statistics?team=${team}&league=${league}&season=${season}`;
  await fetchFromApi(url, `team-stats-${team}-${league}-${season}`, res, 'فشل جلب إحصائيات الفريق');
});

app.get('/api/teams/transfers', async (req, res) => {
  const { team } = req.query;
  const url = `${BASE_URL}/transfers?team=${team}`;
  await fetchFromApi(url, `transfers-${team}`, res, 'فشل جلب الانتقالات');
});

app.get('/api/coaches', async (req, res) => {
  const { team } = req.query;
  const url = `${BASE_URL}/coachs?team=${team}`;
  await fetchFromApi(url, `coaches-${team}`, res, 'فشل جلب المدربين');
});

app.get('/api/trophies', async (req, res) => {
  const { team } = req.query;
  const url = `${BASE_URL}/trophies?team=${team}`;
  await fetchFromApi(url, `trophies-${team}`, res, 'فشل جلب البطولات للفريق');
});

app.get('/api/sidelined', async (req, res) => {
  const { player } = req.query;
  const url = `${BASE_URL}/sidelined?player=${player}`;
  await fetchFromApi(url, `sidelined-${player}`, res, 'فشل جلب قائمة الغيابات');
});

// 6. اللاعبين
app.get('/api/players/by-team', async (req, res) => {
  const { team, season } = req.query;
  const url = `${BASE_URL}/players?team=${team}&season=${season}`;
  await fetchFromApi(url, `players-${team}-${season}`, res, 'فشل جلب اللاعبين');
});

app.get('/api/player/:id', async (req, res) => {
  const url = `${BASE_URL}/players?id=${req.params.id}`;
  await fetchFromApi(url, `player-${req.params.id}`, res, 'فشل جلب بيانات اللاعب');
});

app.get('/api/players/statistics', async (req, res) => {
  const { player, season, league } = req.query;
  const url = `${BASE_URL}/players/statistics?player=${player}&season=${season}&league=${league}`;
  await fetchFromApi(url, `player-stats-${player}-${season}-${league}`, res, 'فشل جلب إحصائيات اللاعب');
});

// 7. الملاعب + الهدافين
app.get('/api/venues', async (req, res) => {
  const { id } = req.query;
  const url = id ? `${BASE_URL}/venues?id=${id}` : `${BASE_URL}/venues`;
  await fetchFromApi(url, `venues-${id || 'all'}`, res, 'فشل جلب الملاعب');
});

app.get('/api/topscorers', async (req, res) => {
  const { league, season } = req.query;
  const url = `${BASE_URL}/players/topscorers?league=${league}&season=${season}`;
  await fetchFromApi(url, `topscorers-${league}-${season}`, res, 'فشل جلب الهدافين');
});

// 8. الترتيب
app.get('/api/standings', async (req, res) => {
  const { league, season } = req.query;
  const url = `${BASE_URL}/standings?league=${league}&season=${season}`;
  await fetchFromApi(url, `standings-${league}-${season}`, res, 'فشل جلب الترتيب');
});

// 9. روت عام لأي Endpoint (احتياطي)
app.get('/api/*', async (req, res) => {
  const pathAfterApi = req.path.replace(/^\/api\//, '');
  const query = req.originalUrl.split('?')[1] || '';
  const fullUrl = `${BASE_URL}/${pathAfterApi}?${query}`;
  await fetchFromApi(fullUrl, `${pathAfterApi}-${query}`, res, 'فشل جلب البيانات العامة');
});

// ⚠️ التعامل مع أي خطأ غير متوقع
app.use((err, req, res, next) => {
  console.error('❌ Unhandled Error:', err);
  res.status(500).json({ error: 'حدث خطأ داخلي في الخادم' });
});

// 🚀 تشغيل السيرفر
app.listen(PORT, () => {
  console.log(`🚀 Server جاهز على http://localhost:${PORT}`);
});