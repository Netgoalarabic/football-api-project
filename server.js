// ✅ تحميل المتغيرات من ملف .env import dotenv from 'dotenv'; dotenv.config();

import moment from 'moment-timezone'; import express from 'express'; import axios from 'axios'; import NodeCache from 'node-cache'; import cors from 'cors';

const app = express(); const cache = new NodeCache(); // زمن التخزين يحدد تلقائيًا حسب نوع الطلب

app.use(cors());

const API_KEY = process.env.API_KEY; const BASE_URL = 'https://v3.football.api-sports.io';

// ✅ دالة طلب بيانات من API مع كاش ذكي حسب نوع البيانات async function fetchWithCache(cacheKey, url, ttl = 300) { if (cache.has(cacheKey)) { return cache.get(cacheKey); } const response = await axios.get(url, { headers: { 'x-apisports-key': API_KEY }, }); cache.set(cacheKey, response.data, ttl); return response.data; }

// ✅ مباريات اليوم app.get('/api/fixtures/today', async (req, res) => { const date = moment().format('YYYY-MM-DD'); const url = ${BASE_URL}/fixtures?date=${date}; const data = await fetchWithCache(fixtures_today, url, 180); // 3 دقائق res.json(data); });

// ✅ مباريات الغد app.get('/api/fixtures/tomorrow', async (req, res) => { const date = moment().add(1, 'day').format('YYYY-MM-DD'); const url = ${BASE_URL}/fixtures?date=${date}; const data = await fetchWithCache(fixtures_tomorrow, url, 1800); // 30 دقيقة res.json(data); });

// ✅ مباريات مباشرة app.get('/api/fixtures/live', async (req, res) => { const url = ${BASE_URL}/fixtures?live=all; const data = await fetchWithCache(fixtures_live, url, 60); // دقيقة واحدة res.json(data); });

// ✅ مباريات قادمة app.get('/api/fixtures/next', async (req, res) => { const url = ${BASE_URL}/fixtures?next=20; const data = await fetchWithCache(fixtures_next, url, 600); // 10 دقائق res.json(data); });

// ✅ مباريات سابقة app.get('/api/fixtures/previous', async (req, res) => { const url = ${BASE_URL}/fixtures?last=20; const data = await fetchWithCache(fixtures_previous, url, 900); // 15 دقيقة res.json(data); });

// ✅ مباريات حسب التاريخ app.get('/api/fixtures/date/:date', async (req, res) => { const { date } = req.params; const url = ${BASE_URL}/fixtures?date=${date}; const data = await fetchWithCache(fixtures_date_${date}, url, 1800); // 30 دقيقة res.json(data); });

// ✅ تفاصيل مباراة app.get('/api/fixtures/:id', async (req, res) => { const { id } = req.params; const url = ${BASE_URL}/fixtures?id=${id}; const data = await fetchWithCache(fixture_${id}, url, 60); // دقيقة واحدة res.json(data); });

// ✅ جميع البطولات app.get('/api/leagues', async (req, res) => { const url = ${BASE_URL}/leagues; const data = await fetchWithCache('leagues', url, 86400); // يوم واحد res.json(data); });

// ✅ الترتيب حسب الدوري والموسم app.get('/api/standings/:league/:season', async (req, res) => { const { league, season } = req.params; const url = ${BASE_URL}/standings?league=${league}&season=${season}; const data = await fetchWithCache(standings_${league}_${season}, url, 600); // 10 دقائق res.json(data); });

// ✅ معلومات الفريق app.get('/api/teams/:id', async (req, res) => { const { id } = req.params; const url = ${BASE_URL}/teams?id=${id}; const data = await fetchWithCache(team_${id}, url, 3600); // ساعة res.json(data); });

// ✅ إحصائيات الفريق في دوري معين app.get('/api/teams/:id/stats/:league/:season', async (req, res) => { const { id, league, season } = req.params; const url = ${BASE_URL}/teams/statistics?team=${id}&league=${league}&season=${season}; const data = await fetchWithCache(team_stats_${id}_${league}_${season}, url, 600); // 10 دقائق res.json(data); });

// ✅ لاعبو الفريق في موسم معين app.get('/api/players/:id/:season', async (req, res) => { const { id, season } = req.params; const url = ${BASE_URL}/players?team=${id}&season=${season}; const data = await fetchWithCache(players_${id}_${season}, url, 3600); // ساعة res.json(data); });

// ✅ تفاصيل لاعب حسب الموسم app.get('/api/player/:id/:season', async (req, res) => { const { id, season } = req.params; const url = ${BASE_URL}/players?id=${id}&season=${season}; const data = await fetchWithCache(player_${id}_${season}, url, 900); // 15 دقيقة res.json(data); });

// ✅ المواجهات بين فريقين app.get('/api/h2h/:team1/:team2', async (req, res) => { const { team1, team2 } = req.params; const url = ${BASE_URL}/fixtures/headtohead?h2h=${team1}-${team2}; const data = await fetchWithCache(h2h_${team1}_${team2}, url, 600); // 10 دقائق res.json(data); });

// ✅ تشغيل السيرفر على المنفذ 3001 const PORT = process.env.PORT || 3001; app.listen(PORT, () => { console.log(⚽ Server is running on port ${PORT}); });

