const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const app = express();
const PORT = 8000;
const ROOT = __dirname;
const DATA_DIR = path.join(ROOT, 'data');
const UPLOAD_DIR = path.join(ROOT, 'uploads');
const SITE_DIR_NAME = 'films';
const SITE_UPLOAD_DIR = path.join(UPLOAD_DIR, SITE_DIR_NAME);
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const SESSIONS_FILE = path.join(DATA_DIR, 'sessions.json');
const VIDEOS_FILE = path.join(DATA_DIR, 'videos.json');
const TAGS_FILE = path.join(DATA_DIR, 'tags.json');
const ACTIVITY_LOG_FILE = path.join(DATA_DIR, 'activity.log');

fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(UPLOAD_DIR, { recursive: true });
fs.mkdirSync(SITE_UPLOAD_DIR, { recursive: true });

const DEFAULT_TAGS = [
  'Action',
  'Animation',
  'Aventure',
  'Comédie',
  'Documentaire',
  'Drame',
  'Fantastique',
  'Horreur',
  'Policier',
  'Sci-Fi',
  'Séries',
  'Thriller',
  'Films',
  'Autre'
];

function generateId() {
  if (typeof crypto.randomUUID === 'function') {
    try {
      return crypto.randomUUID();
    } catch {
      // fallback
    }
  }
  return crypto.randomBytes(16).toString('hex');
}

function ensureFile(filePath, defaultData) {
  try {
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, JSON.stringify(defaultData, null, 2), 'utf8');
    }
  } catch (err) {
    console.error(`Error ensuring file ${filePath}:`, err);
  }
}

ensureFile(USERS_FILE, []);
ensureFile(SESSIONS_FILE, {});
ensureFile(VIDEOS_FILE, []);
ensureFile(TAGS_FILE, DEFAULT_TAGS);

function readJson(filePath) {
  try {
    if (!fs.existsSync(filePath)) return null;
    const content = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(content);
  } catch (error) {
    return null;
  }
}

function writeJson(filePath, data) {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
  } catch (err) {
    console.error(`Error writing file ${filePath}:`, err);
  }
}

function hashPassword(password) {
  return crypto.createHash('sha256').update(String(password || '')).digest('hex');
}

function getUsers() {
  const users = readJson(USERS_FILE);
  return Array.isArray(users) ? users : [];
}

function saveUsers(users) {
  writeJson(USERS_FILE, users);
}

function getSessions() {
  const sessions = readJson(SESSIONS_FILE);
  return sessions && typeof sessions === 'object' && !Array.isArray(sessions) ? sessions : {};
}

function saveSessions(sessions) {
  writeJson(SESSIONS_FILE, sessions);
}

function getVideos() {
  const videos = readJson(VIDEOS_FILE);
  return Array.isArray(videos) ? videos : [];
}

function saveVideos(videos) {
  writeJson(VIDEOS_FILE, videos);
}

function getTags() {
  const tags = readJson(TAGS_FILE);
  return Array.isArray(tags) && tags.length ? tags : DEFAULT_TAGS;
}

function saveTags(tags) {
  writeJson(TAGS_FILE, tags);
}

function randomToken() {
  return crypto.randomBytes(32).toString('hex');
}

function getUserFromCookie(req) {
  try {
    const cookie = req.headers.cookie || '';
    const tokenPart = cookie.split(';').map((part) => part.trim()).find((part) => part.startsWith('session='));
    if (!tokenPart) return null;
    const sessionToken = tokenPart.split('=')[1];
    if (!sessionToken) return null;
    const sessions = getSessions();
    const userId = sessions[sessionToken];
    if (!userId) return null;
    const users = getUsers();
    const user = users.find((entry) => entry && entry.id === userId);
    return user || null;
  } catch (err) {
    return null;
  }
}

function formatLogDate() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function getClientIp(req) {
  if (!req) return 'inconnue';
  return (
    req.headers['cf-connecting-ip'] ||
    req.headers['x-forwarded-for']?.split(',')[0].trim() ||
    req.headers['x-real-ip'] ||
    req.socket?.remoteAddress ||
    'inconnue'
  );
}

function logEvent(type, message, req = null) {
  const time = formatLogDate();
  const ip = getClientIp(req);
  let userStr = 'visiteur';
  try {
    const user = req ? getUserFromCookie(req) : null;
    if (user && user.username) userStr = user.username;
  } catch (e) {}

  const logLine = `[${time}] [${type.padEnd(6)}] [${userStr}@${ip}] ${message}`;

  const colors = {
    PLAY: '\x1b[35m',   // Magenta
    UPLOAD: '\x1b[32m', // Vert
    CHUNK: '\x1b[36m',  // Cyan
    DELETE: '\x1b[31m', // Rouge
    TAGS: '\x1b[33m',   // Jaune
    AUTH: '\x1b[34m',   // Bleu
    ERROR: '\x1b[41m\x1b[37m', // Rouge vif
    WARN: '\x1b[33m',   // Jaune
    INFO: '\x1b[90m'    // Gris
  };
  const c = colors[type] || '\x1b[0m';
  console.log(`${c}${logLine}\x1b[0m`);

  try {
    if (fs.existsSync(ACTIVITY_LOG_FILE)) {
      const stats = fs.statSync(ACTIVITY_LOG_FILE);
      if (stats.size > 10 * 1024 * 1024) { // Rotation si > 10 Mo
        const oldFile = path.join(DATA_DIR, 'activity.old.log');
        if (fs.existsSync(oldFile)) fs.unlinkSync(oldFile);
        fs.renameSync(ACTIVITY_LOG_FILE, oldFile);
      }
    }
    fs.appendFileSync(ACTIVITY_LOG_FILE, logLine + '\n', 'utf8');
  } catch (err) {
    console.error('Error writing activity log:', err);
  }
}

process.on('uncaughtException', (err) => {
  logEvent('ERROR', `EXCEPTION NON GÉRÉE: ${err.message}\n${err.stack}`);
});

process.on('unhandledRejection', (reason) => {
  logEvent('ERROR', `PROMESSE REJETÉE: ${reason && reason.stack ? reason.stack : reason}`);
});

function setSessionCookie(res, token) {
  res.setHeader('Set-Cookie', `session=${token}; Path=/; HttpOnly; SameSite=Lax`);
}

function clearSessionCookie(res) {
  res.setHeader('Set-Cookie', 'session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0');
}

function normalizeTags(rawTags) {
  if (!rawTags) return ['Autre'];
  let tagsList = [];
  if (Array.isArray(rawTags)) {
    tagsList = rawTags;
  } else if (typeof rawTags === 'string') {
    try {
      const parsed = JSON.parse(rawTags);
      if (Array.isArray(parsed)) tagsList = parsed;
      else tagsList = rawTags.split(',');
    } catch {
      tagsList = rawTags.split(',');
    }
  }
  const clean = tagsList
    .map((t) => String(t || '').trim())
    .filter((t) => t.length > 0);
  return clean.length ? [...new Set(clean)] : ['Autre'];
}

function normalizeTitle(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .trim();
}

function ensureUniqueName(baseName, extension) {
  const candidate = `${baseName}${extension}`;
  const targetPath = path.join(SITE_UPLOAD_DIR, candidate);
  if (!fs.existsSync(targetPath)) {
    return candidate;
  }

  let counter = 2;
  while (fs.existsSync(path.join(SITE_UPLOAD_DIR, `${baseName}-${counter}${extension}`))) {
    counter += 1;
  }

  return `${baseName}-${counter}${extension}`;
}

function discoverLocalLibraryVideos() {
  const recognized = new Set(['.mkv', '.mp4', '.avi', '.mov', '.m4v', '.webm', '.mpeg', '.mpg']);
  const results = [];

  function walk(currentDir) {
    try {
      const entries = fs.readdirSync(currentDir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(currentDir, entry.name);
        if (entry.isDirectory()) {
          if (['data', 'uploads', 'node_modules', '.git'].includes(entry.name)) {
            continue;
          }
          walk(fullPath);
          continue;
        }

        const extension = path.extname(entry.name).toLowerCase();
        if (!recognized.has(extension)) continue;

        const relativePath = path.relative(ROOT, fullPath).replace(/\\/g, '/');
        if (relativePath.startsWith('data/') || relativePath.startsWith('uploads/') || relativePath.startsWith('node_modules/')) {
          continue;
        }

        const title = path.basename(entry.name, extension);
        let tags = ['Films'];
        if (title.toLowerCase().includes('montecristo')) {
          tags = ['Films', 'Aventure', 'Drame'];
        }

        results.push({
          id: `library:${relativePath}`,
          title,
          tags,
          quality: '1080p',
          language: 'VF',
          filename: relativePath,
          mimeType: `video/${extension === '.mkv' ? 'x-matroska' : extension.slice(1)}`,
          src: `/${encodeURI(relativePath)}`,
          sourceType: 'library',
          createdAt: new Date(fs.statSync(fullPath).mtime).toISOString()
        });
      }
    } catch (err) {
      // ignore
    }
  }

  walk(ROOT);
  return results.sort((a, b) => a.title.localeCompare(b.title, 'fr'));
}

app.use(express.json({ limit: '200mb' }));
app.use(express.urlencoded({ extended: true, limit: '200mb' }));
app.use('/uploads', express.static(UPLOAD_DIR));
app.use(`/${SITE_DIR_NAME}`, express.static(SITE_UPLOAD_DIR));
app.use(express.static(ROOT));

const RECOGNIZED_VIDEO_EXTS = new Set(['.mp4', '.mkv', '.avi', '.mov', '.webm', '.m4v', '.mpeg', '.mpg', '.wmv', '.flv', '.ts', '.m2ts', '.vob', '.iso']);

const uploadStorage = multer.diskStorage({
  destination: function (_req, _file, cb) {
    cb(null, SITE_UPLOAD_DIR);
  },
  filename: function (req, file, cb) {
    const extension = path.extname(file.originalname).toLowerCase() || '.mp4';
    const title = String(req.body.title || path.parse(file.originalname).name || 'video').trim();
    const quality = String(req.body.quality || '1080p').trim().replace(/\s+/g, '').toLowerCase();
    const language = String(req.body.language || 'VF').trim().toUpperCase();
    const baseName = normalizeTitle(`${title}-${quality}-${language}`) || 'video';
    const uniqueName = ensureUniqueName(baseName, extension);
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage: uploadStorage,
  limits: { fileSize: 50 * 1024 * 1024 * 1024 }, // 50 Go
  fileFilter: function (_req, file, cb) {
    const ext = path.extname(file.originalname || '').toLowerCase();
    if (
      (file.mimetype && file.mimetype.startsWith('video/')) ||
      RECOGNIZED_VIDEO_EXTS.has(ext) ||
      file.mimetype === 'application/octet-stream' ||
      file.mimetype === 'application/x-matroska'
    ) {
      cb(null, true);
    } else {
      cb(new Error('Type de fichier non supporté'));
    }
  }
});

const CHUNKS_DIR = path.join(UPLOAD_DIR, '.chunks');
fs.mkdirSync(CHUNKS_DIR, { recursive: true });

const chunkStorage = multer.diskStorage({
  destination: function (_req, _file, cb) {
    cb(null, CHUNKS_DIR);
  },
  filename: function (_req, file, cb) {
    cb(null, `tmp-${Date.now()}-${crypto.randomBytes(8).toString('hex')}`);
  }
});

const chunkUpload = multer({
  storage: chunkStorage,
  limits: { fileSize: 100 * 1024 * 1024 }
});

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

// Logs API & Tracking lecture de films
app.post('/api/log/play', (req, res) => {
  try {
    const body = req.body || {};
    const title = String(body.title || 'Film inconnu').trim();
    const id = String(body.id || body.videoId || '').trim();
    const filename = String(body.filename || '').trim();

    logEvent('PLAY', `Film lancé : "${title}" (Fichier: ${filename || id || 'direct'})`, req);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'erreur_log' });
  }
});

app.get('/api/logs', (req, res) => {
  try {
    if (!fs.existsSync(ACTIVITY_LOG_FILE)) {
      return res.json({ logs: [] });
    }
    const content = fs.readFileSync(ACTIVITY_LOG_FILE, 'utf8');
    const lines = content.split('\n').filter((l) => l.trim().length > 0);
    const limit = Math.min(parseInt(req.query.limit || '100', 10), 500);
    res.json({ logs: lines.slice(-limit) });
  } catch (err) {
    res.status(500).json({ error: 'erreur_lecture_logs' });
  }
});

app.get('/api/me', (req, res) => {
  try {
    const user = getUserFromCookie(req);
    if (!user) {
      return res.status(401).json({ error: 'non_authentifie' });
    }
    res.json({ user: { id: user.id, username: user.username, isAdmin: Boolean(user.isAdmin) } });
  } catch (err) {
    res.status(500).json({ error: 'erreur_serveur' });
  }
});

app.post('/api/register', (req, res) => {
  try {
    const body = req.body || {};
    const username = String(body.username || '').trim();
    const password = String(body.password || '');

    if (username.length < 3) {
      logEvent('WARN', `Tentative inscription rejetée (pseudo trop court : "${username}")`, req);
      return res.status(400).json({ error: 'pseudo_trop_court' });
    }
    if (password.length < 4) {
      logEvent('WARN', `Tentative inscription rejetée (mdp trop court pour "${username}")`, req);
      return res.status(400).json({ error: 'mot_de_passe_trop_court' });
    }

    const users = getUsers();
    if (users.some((user) => user && user.username && user.username.toLowerCase() === username.toLowerCase())) {
      logEvent('WARN', `Tentative inscription rejetée (compte déjà existant : "${username}")`, req);
      return res.status(409).json({ error: 'compte_existe' });
    }

    const newUser = {
      id: generateId(),
      username,
      passwordHash: hashPassword(password),
      isAdmin: users.length === 0,
      createdAt: new Date().toISOString()
    };

    users.push(newUser);
    saveUsers(users);

    const token = randomToken();
    const sessions = getSessions();
    sessions[token] = newUser.id;
    saveSessions(sessions);
    setSessionCookie(res, token);

    logEvent('AUTH', `Nouveau compte créé : "${newUser.username}" (Admin: ${newUser.isAdmin})`, req);

    return res.status(201).json({
      user: {
        id: newUser.id,
        username: newUser.username,
        isAdmin: Boolean(newUser.isAdmin)
      }
    });
  } catch (err) {
    logEvent('ERROR', `Erreur lors de l'inscription : ${err.message}`, req);
    console.error('Register error:', err);
    return res.status(500).json({ error: 'erreur_serveur', details: err.message });
  }
});

app.post('/api/login', (req, res) => {
  try {
    const body = req.body || {};
    const username = String(body.username || '').trim();
    const password = String(body.password || '');
    const users = getUsers();
    const user = users.find(
      (entry) => entry && entry.username && entry.username.toLowerCase() === username.toLowerCase()
    );

    if (!user || user.passwordHash !== hashPassword(password)) {
      logEvent('WARN', `Échec de connexion : identifiants incorrects pour "${username}"`, req);
      return res.status(401).json({ error: 'identifiants_incorrects' });
    }

    const token = randomToken();
    const sessions = getSessions();
    sessions[token] = user.id;
    saveSessions(sessions);
    setSessionCookie(res, token);

    logEvent('AUTH', `Connexion réussie : utilisateur "${user.username}" (Admin: ${Boolean(user.isAdmin)})`, req);

    return res.json({
      user: {
        id: user.id,
        username: user.username,
        isAdmin: Boolean(user.isAdmin)
      }
    });
  } catch (err) {
    logEvent('ERROR', `Erreur lors de la connexion : ${err.message}`, req);
    console.error('Login error:', err);
    return res.status(500).json({ error: 'erreur_serveur', details: err.message });
  }
});

app.post('/api/logout', (req, res) => {
  try {
    const cookie = req.headers.cookie || '';
    const tokenPart = cookie.split(';').map((part) => part.trim()).find((part) => part.startsWith('session='));
    if (tokenPart) {
      const token = tokenPart.split('=')[1];
      if (token) {
        const sessions = getSessions();
        delete sessions[token];
        saveSessions(sessions);
      }
    }
    logEvent('AUTH', `Déconnexion utilisateur`, req);
    clearSessionCookie(res);
    res.json({ ok: true });
  } catch (err) {
    clearSessionCookie(res);
    res.json({ ok: true });
  }
});

// Tags API
app.get('/api/tags', (_req, res) => {
  res.json({ tags: getTags() });
});

app.post('/api/tags', (req, res) => {
  try {
    const user = getUserFromCookie(req);
    if (!user || !user.isAdmin) {
      logEvent('WARN', `Refus ajout tag (admin requis)`, req);
      return res.status(403).json({ error: 'acces_refuse_admin_requis' });
    }

    const body = req.body || {};
    const tag = String(body.tag || body.name || '').trim();
    if (!tag) {
      return res.status(400).json({ error: 'tag_invalide' });
    }

    const tags = getTags();
    if (!tags.some((t) => t.toLowerCase() === tag.toLowerCase())) {
      tags.push(tag);
      tags.sort((a, b) => a.localeCompare(b, 'fr'));
      saveTags(tags);
      logEvent('TAGS', `Nouveau tag créé : "${tag}"`, req);
    }

    res.status(201).json({ ok: true, tags: getTags() });
  } catch (err) {
    logEvent('ERROR', `Erreur création tag : ${err.message}`, req);
    res.status(500).json({ error: 'erreur_serveur' });
  }
});

app.delete('/api/tags/:name', (req, res) => {
  try {
    const user = getUserFromCookie(req);
    if (!user || !user.isAdmin) {
      logEvent('WARN', `Refus suppression tag (admin requis)`, req);
      return res.status(403).json({ error: 'acces_refuse_admin_requis' });
    }

    const targetName = decodeURIComponent(req.params.name).trim().toLowerCase();
    let tags = getTags();
    tags = tags.filter((t) => t.toLowerCase() !== targetName);
    saveTags(tags);

    logEvent('TAGS', `Tag supprimé : "${targetName}"`, req);
    res.json({ ok: true, tags: getTags() });
  } catch (err) {
    logEvent('ERROR', `Erreur suppression tag : ${err.message}`, req);
    res.status(500).json({ error: 'erreur_serveur' });
  }
});

// Video list (public pour tous : connectés et non-connectés)
app.get('/api/videos', (_req, res) => {
  try {
    const siteVideos = discoverLocalLibraryVideos();
    const allUserVideos = getVideos();

    const videos = [...siteVideos, ...allUserVideos].map((video) => {
      let videoTags = video.tags;
      if (!videoTags || !Array.isArray(videoTags) || !videoTags.length) {
        videoTags = video.category ? [video.category] : ['Films'];
      }

      return {
        id: video.id,
        userId: video.userId,
        title: video.title,
        tags: normalizeTags(videoTags),
        quality: video.quality || '1080p',
        language: video.language || 'VF',
        filename: video.filename || video.src?.replace(/^\//, ''),
        mimeType: video.mimeType || 'video/mp4',
        src: video.src || `/${SITE_DIR_NAME}/${video.filename}`,
        sourceType: video.sourceType || 'user',
        createdAt: video.createdAt
      };
    });

    res.json({ videos });
  } catch (err) {
    logEvent('ERROR', `Erreur listing vidéos : ${err.message}`, _req);
    res.status(500).json({ error: 'erreur_serveur' });
  }
});

// Video upload
app.post('/api/videos', upload.single('file'), (req, res) => {
  try {
    const user = getUserFromCookie(req);
    if (!user) {
      logEvent('WARN', `Upload refusé : non authentifié`, req);
      return res.status(401).json({ error: 'non_authentifie' });
    }

    if (!req.file) {
      logEvent('WARN', `Upload rejeté : aucun fichier vidéo fourni`, req);
      return res.status(400).json({ error: 'video_absente' });
    }

    const title = String(req.body.title || '').trim() || path.parse(req.file.originalname).name || 'Vidéo perso';
    const tags = normalizeTags(req.body.tags || req.body.category || 'Films');
    const quality = String(req.body.quality || '1080p').trim() || '1080p';
    const language = String(req.body.language || 'VF').trim() || 'VF';
    const relativeFileName = req.file.filename;

    const currentTags = getTags();
    let tagsUpdated = false;
    tags.forEach((t) => {
      if (!currentTags.some((ct) => ct.toLowerCase() === t.toLowerCase())) {
        currentTags.push(t);
        tagsUpdated = true;
      }
    });
    if (tagsUpdated) {
      currentTags.sort((a, b) => a.localeCompare(b, 'fr'));
      saveTags(currentTags);
    }

    const videos = getVideos();
    const video = {
      id: generateId(),
      userId: user.id,
      title,
      tags,
      quality,
      language,
      filename: relativeFileName,
      mimeType: req.file.mimetype || 'video/mp4',
      createdAt: new Date().toISOString()
    };
    videos.push(video);
    saveVideos(videos);

    logEvent('UPLOAD', `Nouveau film publié : "${video.title}" (${video.quality}, ${video.language}) -> ${video.filename}`, req);

    res.status(201).json({
      video: {
        id: video.id,
        userId: video.userId,
        title: video.title,
        tags: video.tags,
        quality: video.quality,
        language: video.language,
        filename: video.filename,
        mimeType: video.mimeType,
        src: `/${SITE_DIR_NAME}/${video.filename}`
      }
    });
  } catch (err) {
    logEvent('ERROR', `Erreur upload direct : ${err.message}`, req);
    console.error('Upload video error:', err);
    res.status(500).json({ error: 'erreur_serveur', details: err.message });
  }
});

// Video chunked upload (compatible Cloudflare < 100 Mo)
app.post('/api/videos/chunk', chunkUpload.single('chunk'), async (req, res) => {
  let tempFilePath = req.file ? req.file.path : null;
  try {
    const user = getUserFromCookie(req);
    if (!user) {
      if (tempFilePath && fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
      logEvent('WARN', `Upload par morceaux refusé : non authentifié`, req);
      return res.status(401).json({ error: 'non_authentifie' });
    }

    if (!req.file) {
      logEvent('WARN', `Morceau manquant dans la requête`, req);
      return res.status(400).json({ error: 'morceau_absent' });
    }

    const uploadId = String(req.body.uploadId || '').replace(/[^a-zA-Z0-9_-]/g, '');
    const chunkIndex = parseInt(req.body.chunkIndex, 10);
    const totalChunks = parseInt(req.body.totalChunks, 10);

    if (!uploadId || isNaN(chunkIndex) || isNaN(totalChunks) || totalChunks <= 0 || chunkIndex < 0 || chunkIndex >= totalChunks) {
      if (tempFilePath && fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
      logEvent('WARN', `Paramètres de chunk invalides (chunkIndex: ${chunkIndex}/${totalChunks})`, req);
      return res.status(400).json({ error: 'parametres_invalides' });
    }

    const uploadSessionDir = path.join(CHUNKS_DIR, uploadId);
    if (!fs.existsSync(uploadSessionDir)) {
      fs.mkdirSync(uploadSessionDir, { recursive: true });
    }

    const targetPartPath = path.join(uploadSessionDir, `part-${chunkIndex}`);
    fs.renameSync(tempFilePath, targetPartPath);

    // Vérifie si toutes les parties sont reçues
    let partsReady = true;
    for (let i = 0; i < totalChunks; i++) {
      if (!fs.existsSync(path.join(uploadSessionDir, `part-${i}`))) {
        partsReady = false;
        break;
      }
    }

    if (!partsReady) {
      if (chunkIndex === 0 || chunkIndex % 10 === 0 || chunkIndex === totalChunks - 1) {
        logEvent('CHUNK', `Morceau ${chunkIndex + 1}/${totalChunks} reçu pour "${req.body.title || req.body.filename || 'video'}"`, req);
      }
      return res.json({ ok: true, chunkIndex, totalChunks });
    }

    // Tous les chunks sont arrivés -> assemblage du fichier final
    const originalName = String(req.body.filename || req.file.originalname || 'video.mp4');
    const extension = path.extname(originalName).toLowerCase() || '.mp4';
    const title = String(req.body.title || '').trim() || path.parse(originalName).name || 'Vidéo perso';
    const quality = String(req.body.quality || '1080p').trim().replace(/\s+/g, '').toLowerCase() || '1080p';
    const language = String(req.body.language || 'VF').trim().toUpperCase() || 'VF';
    const baseName = normalizeTitle(`${title}-${quality}-${language}`) || 'video';
    const uniqueName = ensureUniqueName(baseName, extension);
    const finalPath = path.join(SITE_UPLOAD_DIR, uniqueName);

    logEvent('INFO', `Assemblage de ${totalChunks} morceaux pour "${title}" -> ${uniqueName}...`, req);

    const writeStream = fs.createWriteStream(finalPath);
    for (let i = 0; i < totalChunks; i++) {
      const partPath = path.join(uploadSessionDir, `part-${i}`);
      await new Promise((resolve, reject) => {
        const readStream = fs.createReadStream(partPath);
        readStream.on('error', reject);
        readStream.on('end', () => {
          try { fs.unlinkSync(partPath); } catch (e) {}
          resolve();
        });
        readStream.pipe(writeStream, { end: false });
      });
    }
    writeStream.end();

    await new Promise((resolve, reject) => {
      writeStream.on('finish', resolve);
      writeStream.on('error', reject);
    });

    try {
      fs.rmdirSync(uploadSessionDir);
    } catch (e) {}

    const tags = normalizeTags(req.body.tags || req.body.category || 'Films');
    const currentTags = getTags();
    let tagsUpdated = false;
    tags.forEach((t) => {
      if (!currentTags.some((ct) => ct.toLowerCase() === t.toLowerCase())) {
        currentTags.push(t);
        tagsUpdated = true;
      }
    });
    if (tagsUpdated) {
      currentTags.sort((a, b) => a.localeCompare(b, 'fr'));
      saveTags(currentTags);
    }

    const videos = getVideos();
    const video = {
      id: generateId(),
      userId: user.id,
      title,
      tags,
      quality,
      language,
      filename: uniqueName,
      mimeType: `video/${extension === '.mkv' ? 'x-matroska' : extension.slice(1)}`,
      createdAt: new Date().toISOString()
    };
    videos.push(video);
    saveVideos(videos);

    logEvent('UPLOAD', `Film complet réassemblé et publié : "${video.title}" (${video.quality}, ${video.language}) -> ${video.filename} (${totalChunks} morceaux)`, req);

    return res.status(201).json({
      video: {
        id: video.id,
        userId: video.userId,
        title: video.title,
        tags: video.tags,
        quality: video.quality,
        language: video.language,
        filename: video.filename,
        mimeType: video.mimeType,
        src: `/${SITE_DIR_NAME}/${video.filename}`
      }
    });
  } catch (err) {
    logEvent('ERROR', `Erreur assemblage chunked upload : ${err.message}`, req);
    console.error('Chunk upload error:', err);
    return res.status(500).json({ error: 'erreur_serveur', details: err.message });
  }
});

// Update video tags (Admin or owner)
app.post('/api/videos/:id/tags', (req, res) => {
  try {
    const user = getUserFromCookie(req);
    if (!user) {
      logEvent('WARN', `Modification tags refusée : non authentifié`, req);
      return res.status(401).json({ error: 'non_authentifie' });
    }

    const videos = getVideos();
    const video = videos.find((v) => v && v.id === req.params.id);
    if (!video) {
      return res.status(404).json({ error: 'video_introuvable' });
    }

    if (video.userId !== user.id && !user.isAdmin) {
      logEvent('WARN', `Tentative modification tags interdite sur "${video.title}"`, req);
      return res.status(403).json({ error: 'acces_interdit' });
    }

    const newTags = normalizeTags(req.body.tags);
    video.tags = newTags;
    saveVideos(videos);

    logEvent('TAGS', `Tags modifiés pour "${video.title}" : [${newTags.join(', ')}]`, req);
    res.json({ ok: true, video });
  } catch (err) {
    logEvent('ERROR', `Erreur modification tags : ${err.message}`, req);
    res.status(500).json({ error: 'erreur_serveur' });
  }
});

// Delete video (Admin or owner)
app.delete('/api/videos/:id', (req, res) => {
  try {
    const user = getUserFromCookie(req);
    if (!user) {
      logEvent('WARN', `Suppression vidéo refusée : non authentifié`, req);
      return res.status(401).json({ error: 'non_authentifie' });
    }

    const videos = getVideos();
    const idx = videos.findIndex(
      (video) => video && video.id === req.params.id && (video.userId === user.id || user.isAdmin)
    );
    if (idx === -1) {
      return res.status(404).json({ error: 'video_introuvable' });
    }

    const removed = videos[idx];
    const filePath = path.join(SITE_UPLOAD_DIR, removed.filename);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

    videos.splice(idx, 1);
    saveVideos(videos);

    logEvent('DELETE', `Film supprimé : "${removed.title}" (${removed.filename})`, req);
    res.json({ ok: true });
  } catch (err) {
    logEvent('ERROR', `Erreur suppression vidéo : ${err.message}`, req);
    res.status(500).json({ error: 'erreur_serveur' });
  }
});

app.use((error, req, res, _next) => {
  logEvent('ERROR', `Erreur non gérée sur ${req.method} ${req.originalUrl}: ${error ? error.message || error : 'Inconnue'}`, req);
  console.error(`Erreur non gérée sur ${req.method} ${req.originalUrl}:`, error);
  if (error && error.message === 'Type de fichier non supporté') {
    return res.status(400).json({ error: 'fichier_non_video' });
  }
  if (error && error.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ error: 'fichier_trop_volumineux' });
  }
  return res.status(500).json({ error: 'erreur_serveur', details: error && error.message });
});

const server = app.listen(PORT, '0.0.0.0', () => {
  logEvent('INFO', `Serveur VRedPlay Air démarré sur http://0.0.0.0:${PORT}`);
});

// Augmente les timeouts par défaut (2 min) pour supporter les gros uploads vidéo
server.requestTimeout = 0; // désactive le timeout de requête Node
server.headersTimeout = 0;
server.timeout = 0; // désactive le timeout socket par défaut
server.keepAliveTimeout = 0;