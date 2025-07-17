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
app.use(express.static('public')); // تقديم صفحات HTML مباشرة

// 🔐 الإعدادات من .env
const API_KEY = process.env.API_KEY;
const VIP_PASS = process.env.VIP_PASS || '1234';
const PAYZON_KEY = process.env.PAYZON_KEY || '';
const BASE_URL = 'https://v3.football.api-sports.io';
const PORT = process.env.PORT || 3001;

// 🗄️ الكاش
const cache = new NodeCache({ stdTTL: 43200 }); // 12 ساعة

/* ============================================================
   ✅ دالة موحدة لجلب البيانات مع الكاش
============================================================ */
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

/* ============================================================
   ✅ صفحة فحص السيرفر
============================================================ */
app.get('/', (req, res) => {
  res.send('✅ Net Goal Arabic Server شغال!');
});

/* ============================================================
   ✅ التوقعات Predictions
============================================================ */

// تحليل مبسط لنسبة الفوز
const analyzeMatch = (homeStats, awayStats) => {
  const homeWins = homeStats.fixtures.wins.total;
  const awayWins = awayStats.fixtures.wins.total;
  const total = homeWins + awayWins || 1;

  const homeProb = Math.round((homeWins / total) * 100);
  const awayProb = Math.round((awayWins / total) * 100);
  const drawProb = 100 - (homeProb + awayProb > 100 ? 100 : homeProb + awayProb);

  return {
    homeProb,
    drawProb,
    awayProb,
    tip: homeProb >= awayProb ? "فوز الفريق المستضيف ✅" : "فوز الفريق الضيف ✅"
  };
};

// ✅ توقعات مجانية
app.get('/api/predictions/today', async (req, res) => {
  const today = moment().tz('Africa/Casablanca').format('YYYY-MM-DD');
  const url = `${BASE_URL}/fixtures?date=${today}`;

  try {
    const fixturesRes = await axios.get(url, { headers: { 'x-apisports-key': API_KEY } });
    const fixtures = fixturesRes.data.response.slice(0, 5);

    const freePredictions = fixtures.map(m => ({
      match: `${m.teams.home.name} vs ${m.teams.away.name}`,
      time: m.fixture.date,
      league: m.league.name,
      country: m.league.country,
      free_tip: "أكثر من 2.5 هدف ✅"
    }));
    res.json(freePredictions);

  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'فشل جلب توقعات اليوم' });
  }
});

// ✅ توقعات VIP (محمية بكلمة مرور مؤقتة)
app.get('/api/predictions/vip', async (req, res) => {
  const pass = req.query.pass;
  if (pass !== VIP_PASS) return res.status(401).json({ error: 'كلمة مرور VIP غير صحيحة' });

  const today = moment().tz('Africa/Casablanca').format('YYYY-MM-DD');
  const url = `${BASE_URL}/fixtures?date=${today}`;

  try {
    const fixturesRes = await axios.get(url, { headers: { 'x-apisports-key': API_KEY } });
    const fixtures = fixturesRes.data.response.slice(0, 3);

    let vipPredictions = [];

    for (let f of fixtures) {
      const homeStatsUrl = `${BASE_URL}/teams/statistics?team=${f.teams.home.id}&league=${f.league.id}&season=${f.league.season}`;
      const awayStatsUrl = `${BASE_URL}/teams/statistics?team=${f.teams.away.id}&league=${f.league.id}&season=${f.league.season}`;

      const [homeStatsRes, awayStatsRes] = await Promise.all([
        axios.get(homeStatsUrl, { headers: { 'x-apisports-key': API_KEY } }),
        axios.get(awayStatsUrl, { headers: { 'x-apisports-key': API_KEY } })
      ]);

      const stats = analyzeMatch(homeStatsRes.data.response, awayStatsRes.data.response);

      vipPredictions.push({
        match: `${f.teams.home.name} vs ${f.teams.away.name}`,
        league: f.league.name,
        time: f.fixture.date,
        win_probability: {
          home: stats.homeProb,
          draw: stats.drawProb,
          away: stats.awayProb
        },
        vip_tip: stats.tip,
        expected_score: stats.homeProb > stats.awayProb ? "2-1" : "1-2"
      });
    }

    res.json(vipPredictions);

  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'فشل جلب توقعات VIP' });
  }
});

/* ============================================================
   ✅ الدفع Payzon
============================================================ */

// ✅ إنشاء رابط دفع Payzon
app.post('/api/payzon/create', async (req, res) => {
  const { plan, amount } = req.body;
  try {
    const payzonRes = await axios.post('https://api.payzon.ma/create-payment', {
      api_key: PAYZON_KEY,
      amount,
      description: `اشتراك VIP - ${plan}`
    });
    res.json({ payment_url: payzonRes.data.payment_url });
  } catch (err) {
    console.error('Payzon Error:', err.message);
    res.status(500).json({ error: 'فشل إنشاء الدفع' });
  }
});

// ✅ Webhook Payzon لتفعيل الاشتراك مستقبلاً
app.post('/api/payzon/webhook', (req, res) => {
  const { payment_status, user_email } = req.body;
  if (payment_status === 'success') {
    console.log(`✅ تم الدفع بنجاح لـ ${user_email}`);
    // لاحقاً: تخزين الاشتراك في MySQL
  }
  res.sendStatus(200);
});

/* ============================================================
   ✅ باقي الروتات API-Football
============================================================ */

// مباريات اليوم
app.get('/api/fixtures/today', async (req, res) => {
  const today = moment().tz('Africa/Casablanca').format('YYYY-MM-DD');
  const url = `${BASE_URL}/fixtures?date=${today}`;
  await fetchFromApi(url, `fixtures-today-${today}`, res, 'فشل جلب مباريات اليوم');
});

// مباريات الغد
app.get('/api/fixtures/tomorrow', async (req, res) => {
  const tomorrow = moment().tz('Africa/Casablanca').add(1, 'day').format('YYYY-MM-DD');
  const url = `${BASE_URL}/fixtures?date=${tomorrow}`;
  await fetchFromApi(url, `fixtures-tomorrow-${tomorrow}`, res, 'فشل جلب مباريات الغد');
});

// المباريات المباشرة
app.get('/api/fixtures/live', async (req, res) => {
  const url = `${BASE_URL}/fixtures?live=all`;
  await fetchFromApi(url, 'fixtures-live', res, 'فشل جلب المباريات المباشرة');
});

// بطولات حالية
app.get('/api/leagues/active', async (req, res) => {
  const url = `${BASE_URL}/leagues?current=true`;
  await fetchFromApi(url, 'leagues-active', res, 'فشل جلب البطولات');
});

// جميع البطولات
app.get('/api/leagues', async (req, res) => {
  const url = `${BASE_URL}/leagues`;
  await fetchFromApi(url, 'leagues-all', res, 'فشل جلب البطولات');
});

// فرق دوري
app.get('/api/teams/by-league', async (req, res) => {
  const { league, season } = req.query;
  if (!league || !season) return res.status(400).json({ error: 'حدد league و season' });
  const url = `${BASE_URL}/teams?league=${league}&season=${season}`;
  await fetchFromApi(url, `teams-${league}-${season}`, res, 'فشل جلب الفرق');
});

// تفاصيل مباراة
app.get('/api/fixtures/:id', async (req, res) => {
  const { id } = req.params;
  const url = `${BASE_URL}/fixtures?id=${id}`;
  await fetchFromApi(url, `fixture-${id}`, res, 'فشل جلب تفاصيل المباراة');
});

// ترتيب الدوري
app.get('/api/standings', async (req, res) => {
  const { league, season } = req.query;
  if (!league || !season) return res.status(400).json({ error: 'حدد league و season' });
  const url = `${BASE_URL}/standings?league=${league}&season=${season}`;
  await fetchFromApi(url, `standings-${league}-${season}`, res, 'فشل جلب الترتيب');
});

// هدافو الدوري
app.get('/api/topscorers', async (req, res) => {
  const { league, season } = req.query;
  if (!league || !season) return res.status(400).json({ error: 'حدد league و season' });
  const url = `${BASE_URL}/players/topscorers?league=${league}&season=${season}`;
  await fetchFromApi(url, `topscorers-${league}-${season}`, res, 'فشل جلب الهدافين');
});

// لاعبو فريق
app.get('/api/players/by-team', async (req, res) => {
  const { team, season } = req.query;
  if (!team || !season) return res.status(400).json({ error: 'حدد team و season' });
  const url = `${BASE_URL}/players?team=${team}&season=${season}`;
  await fetchFromApi(url, `players-${team}-${season}`, res, 'فشل جلب اللاعبين');
});

// تفاصيل لاعب
app.get('/api/player/:id', async (req, res) => {
  const { id } = req.params;
  const url = `${BASE_URL}/players?id=${id}`;
  await fetchFromApi(url, `player-${id}`, res, 'فشل جلب تفاصيل اللاعب');
});

// مباريات فريق
app.get('/api/fixtures/by-team', async (req, res) => {
  const { team, season } = req.query;
  if (!team || !season) return res.status(400).json({ error: 'حدد team و season' });
  const url = `${BASE_URL}/fixtures?team=${team}&season=${season}`;
  await fetchFromApi(url, `fixtures-team-${team}-${season}`, res, 'فشل جلب مباريات الفريق');
});

// روت عام
app.get('/api/*', async (req, res) => {
  const pathAfterApi = req.path.replace(/^\/api\//, '');
  const query = req.originalUrl.split('?')[1] || '';
  const fullUrl = `${BASE_URL}/${pathAfterApi}?${query}`;
  await fetchFromApi(fullUrl, `${pathAfterApi}-${query}`, res, 'فشل جلب البيانات من API-Football');
});

/* ============================================================
   🚀 بدء الخادم
============================================================ */
app.listen(PORT, () => {
  console.log(`🚀 Net Goal Arabic Server يعمل على http://localhost:${PORT}`);
});




