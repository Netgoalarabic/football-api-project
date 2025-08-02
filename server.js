import dotenv from 'dotenv'; dotenv.config();

import moment from 'moment-timezone'; import express from 'express'; import axios from 'axios'; import NodeCache from 'node-cache'; import cors from 'cors'; import helmet from 'helmet'; import rateLimit from 'express-rate-limit'; import Parser from 'rss-parser';

const app = express();

// 🛡️ إعدادات الحماية app.use(helmet()); app.use(cors({ origin: '*' })); app.use(express.json()); app.use(express.static('public'));

// 🛡️ تحديد معدل الطلبات (كل IP: 100 طلب في الساعة) const limiter = rateLimit({ windowMs: 60 * 60 * 1000, max: 100, message: '❌ تم تجاوز عدد الطلبات المسموح بها. حاول لاحقًا.', }); app.use(limiter);

const API_KEY = process.env.API_KEY; const BASE_URL = 'https://v3.football.api-sports.io'; const PORT = process.env.PORT || 3001;

const cache = new NodeCache({ stdTTL: 43200 }); // كاش لمدة 12 ساعة const parser = new Parser();

// 📦 دالة جلب البيانات من API مع كاش const fetchFromApi = async (url, cacheKey, res, errorMsg = 'فشل جلب البيانات') => { try { if (cache.has(cacheKey)) return res.json(cache.get(cacheKey)); const response = await axios.get(url, { headers: { 'x-apisports-key': API_KEY }, timeout: 10000, }); cache.set(cacheKey, response.data); return res.json(response.data); } catch (error) { console.error('❌ API Error:', error.message); return res.status(500).json({ error: errorMsg }); } };

// 🏠 مسار اختبار الخادم app.get('/', (req, res) => res.send('✅ Net Goal Arabic Server شغال!'));

// 📅 مباريات app.get('/api/fixtures/live', async (req, res) => { await fetchFromApi(${BASE_URL}/fixtures?live=all, 'fixtures-live', res, 'فشل جلب المباريات المباشرة'); });

app.get('/api/fixtures/today', async (req, res) => { const today = moment().tz('Africa/Casablanca').format('YYYY-MM-DD'); await fetchFromApi(${BASE_URL}/fixtures?date=${today}, fixtures-today-${today}, res, 'فشل جلب مباريات اليوم'); });

app.get('/api/fixtures/tomorrow', async (req, res) => { const tomorrow = moment().tz('Africa/Casablanca').add(1, 'day').format('YYYY-MM-DD'); await fetchFromApi(${BASE_URL}/fixtures?date=${tomorrow}, fixtures-tomorrow-${tomorrow}, res, 'فشل جلب مباريات الغد'); });

app.get('/api/fixtures/previous', async (req, res) => { await fetchFromApi(${BASE_URL}/fixtures?last=20, 'fixtures-previous', res, 'فشل جلب المباريات السابقة'); });

app.get('/api/fixtures/next', async (req, res) => { await fetchFromApi(${BASE_URL}/fixtures?next=20, 'fixtures-next', res, 'فشل جلب المباريات القادمة'); });

app.get('/api/fixtures/date/:date', async (req, res) => { const { date } = req.params; await fetchFromApi(${BASE_URL}/fixtures?date=${date}, fixtures-date-${date}, res, 'فشل جلب المباريات بتاريخ'); });

app.get('/api/fixtures/:id', async (req, res) => { await fetchFromApi(${BASE_URL}/fixtures?id=${req.params.id}, fixture-${req.params.id}, res, 'فشل جلب تفاصيل المباراة'); });

app.get('/api/h2h', async (req, res) => { const { h2h } = req.query; if (!h2h) return res.status(400).json({ error: 'حدد h2h=homeID-awayID' }); await fetchFromApi(${BASE_URL}/fixtures/headtohead?h2h=${h2h}, h2h-${h2h}, res, 'فشل جلب المواجهات'); });

// 📊 تفاصيل المباراة app.get('/api/fixtures/:id/events', async (req, res) => { await fetchFromApi(${BASE_URL}/fixtures/events?fixture=${req.params.id}, fixture-events-${req.params.id}, res); });

app.get('/api/fixtures/:id/lineups', async (req, res) => { await fetchFromApi(${BASE_URL}/fixtures/lineups?fixture=${req.params.id}, fixture-lineups-${req.params.id}, res); });

app.get('/api/fixtures/:id/statistics', async (req, res) => { await fetchFromApi(${BASE_URL}/fixtures/statistics?fixture=${req.params.id}, fixture-stats-${req.params.id}, res); });

app.get('/api/fixtures/:id/predictions', async (req, res) => { await fetchFromApi(${BASE_URL}/predictions?fixture=${req.params.id}, predictions-${req.params.id}, res); });

// 🏆 الدوريات والمواسم app.get('/api/seasons', async (req, res) => { await fetchFromApi(${BASE_URL}/leagues/seasons, 'seasons', res); });

app.get('/api/countries', async (req, res) => { await fetchFromApi(${BASE_URL}/countries, 'countries', res); });

app.get('/api/leagues', async (req, res) => { await fetchFromApi(${BASE_URL}/leagues, 'leagues', res); });

app.get('/api/leagues/active', async (req, res) => { await fetchFromApi(${BASE_URL}/leagues?current=true, 'leagues-active', res); });

// 🏟️ الملاعب app.get('/api/venues', async (req, res) => { const { id } = req.query; const key = id ? venues-${id} : 'venues-all'; await fetchFromApi(${BASE_URL}/venues${id ? ?id=${id} : ''}, key, res); });

// 📈 الترتيب والهدافين app.get('/api/standings', async (req, res) => { const { league, season } = req.query; await fetchFromApi(${BASE_URL}/standings?league=${league}&season=${season}, standings-${league}-${season}, res); });

app.get('/api/topscorers', async (req, res) => { const { league, season } = req.query; await fetchFromApi(${BASE_URL}/players/topscorers?league=${league}&season=${season}, topscorers-${league}-${season}, res); });

// 🧍‍♂️ اللاعبين والفرق app.get('/api/players/by-team', async (req, res) => { const { team, season } = req.query; await fetchFromApi(${BASE_URL}/players?team=${team}&season=${season}, players-${team}-${season}, res); });

app.get('/api/player/:id', async (req, res) => { await fetchFromApi(${BASE_URL}/players?id=${req.params.id}, player-${req.params.id}, res); });

app.get('/api/players/statistics', async (req, res) => { const { player, season, league } = req.query; await fetchFromApi(${BASE_URL}/players/statistics?player=${player}&season=${season}&league=${league}, player-stats-${player}-${season}-${league}, res); });

app.get('/api/teams/by-league', async (req, res) => { const { league, season } = req.query; await fetchFromApi(${BASE_URL}/teams?league=${league}&season=${season}, teams-${league}-${season}, res); });

app.get('/api/teams/statistics', async (req, res) => { const { team, league, season } = req.query; await fetchFromApi(${BASE_URL}/teams/statistics?team=${team}&league=${league}&season=${season}, team-stats-${team}-${league}-${season}, res); });

app.get('/api/teams/transfers', async (req, res) => { const { team } = req.query; await fetchFromApi(${BASE_URL}/transfers?team=${team}, transfers-${team}, res); });

// 🧠 مدربين - إصابات - بطولات app.get('/api/coaches', async (req, res) => { const { team } = req.query; await fetchFromApi(${BASE_URL}/coachs?team=${team}, coaches-${team}, res); });

app.get('/api/injuries', async (req, res) => { const { league, season } = req.query; await fetchFromApi(${BASE_URL}/injuries?league=${league}&season=${season}, injuries-${league}-${season}, res); });

app.get('/api/trophies', async (req, res) => { const { team } = req.query; await fetchFromApi(${BASE_URL}/trophies?team=${team}, trophies-${team}, res); });

app.get('/api/sidelined', async (req, res) => { const { player } = req.query; await fetchFromApi(${BASE_URL}/sidelined?player=${player}, sidelined-${player}, res); });

// 🛠️ مسار احتياطي عام app.get('/api/*', async (req, res) => { const pathAfterApi = req.path.replace(/^/api//, ''); const query = req.originalUrl.split('?')[1] || ''; const fullUrl = ${BASE_URL}/${pathAfterApi}?${query}; await fetchFromApi(fullUrl, ${pathAfterApi}-${query}, res); });

// ⚠️ خطأ غير متوقع app.use((err, req, res, next) => { console.error('❌ Unhandled Error:', err); res.status(500).json({ error: 'حدث خطأ داخلي في الخادم' }); });

// 🚀 بدء الخادم app.listen(PORT, () => { console.log(🚀 Server جاهز على http://localhost:${PORT}); });

