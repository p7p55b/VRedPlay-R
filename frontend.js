const apiBase = '/api';

function getCurrentMode() {
  return localStorage.getItem('vplay_mode') === 'orange' ? 'orange' : 'default';
}

function applyThemeAndBrand() {
  const isOrange = getCurrentMode() === 'orange';
  const brandTitle = document.getElementById('brandTitle');
  if (isOrange) {
    document.body.classList.add('theme-orange');
    if (brandTitle) brandTitle.innerHTML = 'VOrangePlay \'Air <span class="badge-mode">V2</span>';
  } else {
    document.body.classList.remove('theme-orange');
    if (brandTitle) brandTitle.innerHTML = 'VRedPlay \'Air';
  }
}

function showModeToast(message) {
  let toast = document.getElementById('modeToast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'modeToast';
    toast.className = 'mode-toast';
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.style.display = 'block';
  clearTimeout(toast._timeout);
  toast._timeout = setTimeout(() => {
    toast.style.display = 'none';
  }, 2500);
}

const appState = {
  user: null,
  videos: [],
  tags: getCurrentMode() === 'orange' ? [
    'Adulte',
    'Charme',
    'XXX',
    'Amateur',
    'Hentai',
    'Parodie',
    'VR',
    'Autre'
  ] : [
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
  ],
  activeTag: 'all',
  searchQuery: '',
  selectedUploadTags: new Set([getCurrentMode() === 'orange' ? 'Adulte' : 'Films']),
  selectedEditTags: new Set(),
  editingVideo: null
};

let isUploading = false;

// Protection contre la fermeture accidentelle de l'onglet pendant l'upload
window.addEventListener('beforeunload', (e) => {
  if (isUploading) {
    e.preventDefault();
    e.returnValue = 'Un envoie est en cours. Si vous fermez cet onglet, le transfert sera annulé.';
    return e.returnValue;
  }
});

// Interception des clics sur les liens si un upload tourne
document.addEventListener('click', (e) => {
  const link = e.target.closest('a');
  if (link && isUploading) {
    if (!confirm('⚠️ Un envoie est en cours d’envoi.\nSi vous quittez cette page maintenant, le transfert sera interrompu.\n\nVoulez-vous vraiment quitter ?')) {
      e.preventDefault();
      e.stopPropagation();
    }
  }
});

// DOM elements
const authStatus = document.getElementById('authStatus');
const adminBadge = document.getElementById('adminBadge');
const openAuthBtn = document.getElementById('openAuthBtn');
const logoutBtn = document.getElementById('logoutBtn');
const authModal = document.getElementById('authModal');
const closeAuthBtn = document.getElementById('closeAuthBtn');
const loginPanel = document.getElementById('loginPanel');
const registerPanel = document.getElementById('registerPanel');
const loginTab = document.getElementById('loginTab');
const registerTab = document.getElementById('registerTab');
const loginForm = document.getElementById('loginForm');
const registerForm = document.getElementById('registerForm');

const categoryList = document.getElementById('categoryList');
const adminTagPanel = document.getElementById('adminTagPanel');
const addTagForm = document.getElementById('addTagForm');
const newTagInput = document.getElementById('newTagInput');

const uploadPanel = document.getElementById('uploadPanel');
const uploadForm = document.getElementById('uploadForm');
const uploadTagsPills = document.getElementById('uploadTagsPills');
const videoTagsCustom = document.getElementById('videoTagsCustom');

const libraryHeadline = document.getElementById('libraryHeadline');
const movieSearch = document.getElementById('movieSearch');
const movieGrid = document.getElementById('movieGrid');

const editTagsModal = document.getElementById('editTagsModal');
const editTagsTitle = document.getElementById('editTagsTitle');
const editTagsForm = document.getElementById('editTagsForm');
const editTagsPills = document.getElementById('editTagsPills');
const editTagsCustom = document.getElementById('editTagsCustom');
const closeEditTagsBtn = document.getElementById('closeEditTagsBtn');

const playerModal = document.getElementById('playerModal');
const moviePlayer = document.getElementById('moviePlayer');
const playerTitle = document.getElementById('playerTitle');
const closePlayerBtn = document.getElementById('closePlayer');

function showMessage(elementId, message, type = '') {
  const el = document.getElementById(elementId);
  if (!el) return;
  el.textContent = message;
  el.classList.remove('success', 'error');
  if (type) el.classList.add(type);
}

async function apiRequest(path, options = {}, retries = 2) {
  try {
    const response = await fetch(`${apiBase}${path}`, {
      credentials: 'same-origin',
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {})
      },
      ...options
    });

    if (response.status === 502 && retries > 0) {
      await new Promise((r) => setTimeout(r, 700));
      return apiRequest(path, options, retries - 1);
    }

    const contentType = response.headers.get('content-type') || '';
    const isJson = contentType.includes('application/json');
    const data = isJson ? await response.json() : null;

    if (!response.ok) {
      if (response.status === 502) {
        throw new Error('Le serveur démarre ou est temporairement indisponible (502). Veuillez réessayer.');
      }
      const message = data && data.error ? data.error : `HTTP ${response.status}`;
      throw new Error(message);
    }

    return data;
  } catch (error) {
    if (retries > 0 && (error.message.includes('502') || error.message.includes('Failed to fetch'))) {
      await new Promise((r) => setTimeout(r, 700));
      return apiRequest(path, options, retries - 1);
    }
    throw error;
  }
}

// Modal Auth helpers
function openAuthModal(mode = 'login') {
  setAuthMode(mode);
  if (authModal) {
    authModal.classList.remove('hidden');
    authModal.setAttribute('aria-hidden', 'false');
  }
  const inputToFocus = mode === 'register'
    ? document.getElementById('registerUsername')
    : document.getElementById('loginUsername');
  if (inputToFocus) setTimeout(() => inputToFocus.focus(), 50);
}

function closeAuthModal() {
  if (authModal) {
    authModal.classList.add('hidden');
    authModal.setAttribute('aria-hidden', 'true');
  }
  showMessage('loginMessage', '', '');
  showMessage('registerMessage', '', '');
}

function setAuthMode(mode) {
  const activeMode = mode === 'register' ? 'register' : 'login';
  if (loginPanel) loginPanel.classList.toggle('hidden', activeMode !== 'login');
  if (registerPanel) registerPanel.classList.toggle('hidden', activeMode !== 'register');
  if (loginTab) loginTab.classList.toggle('active', activeMode === 'login');
  if (registerTab) registerTab.classList.toggle('active', activeMode === 'register');
}

// Category & Tag List
function renderCategoryList() {
  if (!categoryList) return;
  categoryList.innerHTML = '';

  const totalCount = appState.videos.length;

  // "Toutes les catégories" item
  const allItem = document.createElement('div');
  allItem.className = 'category-item';

  const allBtn = document.createElement('button');
  allBtn.type = 'button';
  allBtn.className = `category-btn ${appState.activeTag === 'all' ? 'active' : ''}`;
  allBtn.innerHTML = `<span>📂 Toutes les catégories</span> <span class="category-count">${totalCount}</span>`;
  allBtn.addEventListener('click', () => {
    appState.activeTag = 'all';
    renderCategoryList();
    updateLibraryView();
  });
  allItem.appendChild(allBtn);
  categoryList.appendChild(allItem);

  // Individual tags
  const isAdmin = Boolean(appState.user && appState.user.isAdmin);

  appState.tags.forEach((tag) => {
    const count = appState.videos.filter((v) =>
      (v.tags || []).some((t) => t.toLowerCase() === tag.toLowerCase())
    ).length;

    const item = document.createElement('div');
    item.className = 'category-item';

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `category-btn ${appState.activeTag.toLowerCase() === tag.toLowerCase() ? 'active' : ''}`;
    btn.innerHTML = `<span>🏷️ ${tag}</span> <span class="category-count">${count}</span>`;
    btn.addEventListener('click', () => {
      appState.activeTag = tag;
      renderCategoryList();
      updateLibraryView();
    });
    item.appendChild(btn);

    // If admin, show delete tag button
    if (isAdmin) {
      const delBtn = document.createElement('button');
      delBtn.type = 'button';
      delBtn.className = 'category-del-btn';
      delBtn.title = `Supprimer le tag "${tag}"`;
      delBtn.textContent = '✕';
      delBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        if (!confirm(`Supprimer définitivement le tag "${tag}" ?`)) return;
        try {
          const mode = getCurrentMode();
          await apiRequest(`/tags/${encodeURIComponent(tag)}${mode === 'orange' ? '?mode=orange' : ''}`, { method: 'DELETE' });
          if (appState.activeTag.toLowerCase() === tag.toLowerCase()) {
            appState.activeTag = 'all';
          }
          await fetchTags();
        } catch (err) {
          appState.tags = appState.tags.filter((t) => t.toLowerCase() !== tag.toLowerCase());
          renderCategoryList();
          renderUploadTagsPicker();
        }
      });
      item.appendChild(delBtn);
    }

    categoryList.appendChild(item);
  });
}

function renderUploadTagsPicker() {
  if (!uploadTagsPills) return;
  uploadTagsPills.innerHTML = '';

  appState.tags.forEach((tag) => {
    const choice = document.createElement('span');
    const isSelected = appState.selectedUploadTags.has(tag);
    choice.className = `tag-choice ${isSelected ? 'selected' : ''}`;
    choice.textContent = tag;
    choice.addEventListener('click', () => {
      if (appState.selectedUploadTags.has(tag)) {
        appState.selectedUploadTags.delete(tag);
      } else {
        appState.selectedUploadTags.add(tag);
      }
      renderUploadTagsPicker();
    });
    uploadTagsPills.appendChild(choice);
  });
}

function renderEditTagsPicker() {
  if (!editTagsPills) return;
  editTagsPills.innerHTML = '';

  appState.tags.forEach((tag) => {
    const choice = document.createElement('span');
    const isSelected = appState.selectedEditTags.has(tag);
    choice.className = `tag-choice ${isSelected ? 'selected' : ''}`;
    choice.textContent = tag;
    choice.addEventListener('click', () => {
      if (appState.selectedEditTags.has(tag)) {
        appState.selectedEditTags.delete(tag);
      } else {
        appState.selectedEditTags.add(tag);
      }
      renderEditTagsPicker();
    });
    editTagsPills.appendChild(choice);
  });
}

function openEditTagsModal(movie) {
  appState.editingVideo = movie;
  appState.selectedEditTags = new Set(movie.tags || []);
  if (editTagsTitle) editTagsTitle.textContent = `Modifier les tags : ${movie.title}`;
  if (editTagsCustom) editTagsCustom.value = '';
  showMessage('editTagsMessage', '', '');
  renderEditTagsPicker();
  if (editTagsModal) {
    editTagsModal.classList.remove('hidden');
    editTagsModal.setAttribute('aria-hidden', 'false');
  }
}

function closeEditTagsModal() {
  if (editTagsModal) {
    editTagsModal.classList.add('hidden');
    editTagsModal.setAttribute('aria-hidden', 'true');
  }
  appState.editingVideo = null;
}

// Data filtering & display
function getVisibleVideos() {
  if (!appState.videos.length) return [];

  let filtered = [...appState.videos];

  if (appState.activeTag !== 'all') {
    const active = appState.activeTag.toLowerCase();
    filtered = filtered.filter((video) =>
      (video.tags || []).some((tag) => tag.toLowerCase() === active)
    );
  }

  const query = appState.searchQuery.trim().toLowerCase();
  if (!query) return filtered;

  return filtered.filter((video) => {
    const tagsStr = (video.tags || []).join(' ');
    const haystack = [
      video.title,
      tagsStr,
      video.quality,
      video.language,
      video.sourceType
    ].filter(Boolean).join(' ').toLowerCase();

    return haystack.includes(query);
  });
}

function updateLibraryView() {
  const visible = getVisibleVideos();

  if (appState.searchQuery) {
    libraryHeadline.textContent = `Recherche : "${appState.searchQuery}" (${visible.length})`;
  } else if (appState.activeTag === 'all') {
    libraryHeadline.textContent = `Tous les films (${visible.length})`;
  } else {
    libraryHeadline.textContent = `Catégorie : ${appState.activeTag} (${visible.length})`;
  }

  buildMovieCards();
}

function buildMovieCards() {
  if (!movieGrid) return;
  movieGrid.innerHTML = '';
  const visibleVideos = getVisibleVideos();

  if (!visibleVideos.length) {
    const empty = document.createElement('div');
    empty.className = 'panel';
    empty.textContent = 'Aucun film trouvé dans cette catégorie.';
    movieGrid.appendChild(empty);
    return;
  }

  const isAdmin = Boolean(appState.user && appState.user.isAdmin);
  const currentUserId = appState.user ? appState.user.id : null;

  visibleVideos.forEach((movie) => {
    const card = document.createElement('article');
    card.className = 'card';

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'movie-button';
    button.setAttribute('aria-label', `Lire ${movie.title}`);
    button.addEventListener('click', () => openPlayerModal(movie));

    const poster = document.createElement('div');
    poster.className = 'poster';
    poster.textContent = movie.sourceType === 'library' ? '📁' : '🎬';

    const info = document.createElement('div');
    info.className = 'movie-info';

    const title = document.createElement('p');
    title.className = 'movie-title';
    title.textContent = movie.title;

    // Tags list
    const tagsContainer = document.createElement('div');
    tagsContainer.className = 'movie-tags-container';
    (movie.tags || ['Films']).forEach((t) => {
      const tagPill = document.createElement('span');
      tagPill.className = 'tag-pill';
      tagPill.textContent = `#${t}`;
      tagPill.addEventListener('click', (e) => {
        e.stopPropagation();
        appState.activeTag = t;
        renderCategoryList();
        updateLibraryView();
      });
      tagsContainer.appendChild(tagPill);
    });

    const meta = document.createElement('div');
    meta.className = 'movie-meta';
    meta.textContent = `${movie.quality || '1080p'} · ${movie.language || 'VF'}`;

    info.appendChild(title);
    info.appendChild(tagsContainer);
    info.appendChild(meta);

    button.appendChild(poster);
    button.appendChild(info);
    card.appendChild(button);

    // Actions (Delete & Tag editing)
    const canDelete = movie.sourceType !== 'library' && (isAdmin || (currentUserId && movie.userId === currentUserId));
    const canEditTags = isAdmin || (currentUserId && movie.userId === currentUserId);

    if (canDelete || canEditTags) {
      const actions = document.createElement('div');
      actions.className = 'movie-actions';

      if (canEditTags) {
        const editTagBtn = document.createElement('button');
        editTagBtn.type = 'button';
        editTagBtn.className = 'btn secondary small';
        editTagBtn.textContent = '🏷️ Tags';
        editTagBtn.title = 'Modifier les tags de ce film';
        editTagBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          openEditTagsModal(movie);
        });
        actions.appendChild(editTagBtn);
      }

      if (canDelete) {
        const removeBtn = document.createElement('button');
        removeBtn.type = 'button';
        removeBtn.className = 'btn secondary small';
        removeBtn.textContent = '🗑️ Supprimer';
        removeBtn.addEventListener('click', async (event) => {
          event.stopPropagation();
          if (!confirm(`Supprimer la vidéo "${movie.title}" ?`)) return;
          try {
            await apiRequest(`/videos/${movie.id}`, { method: 'DELETE' });
            await fetchVideos();
          } catch (error) {
            alert('Impossible de supprimer la vidéo.');
          }
        });
        actions.appendChild(removeBtn);
      }

      card.appendChild(actions);
    }

    movieGrid.appendChild(card);
  });
}

function openPlayerModal(movie) {
  if (!movie || (!movie.source && !movie.src)) return;

  // Notifier le serveur du lancement de la lecture pour les logs
  try {
    fetch(`${apiBase}/log/play`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({
        id: movie.id,
        title: movie.title,
        filename: movie.filename
      }),
      keepalive: true
    }).catch(() => {});
  } catch (e) {}

  const rawSrc = movie.src || movie.source;
  const sourceUrl = rawSrc.startsWith('http')
    ? rawSrc
    : `${window.location.origin}${rawSrc}`;

  window.location.assign(sourceUrl);
}

function closePlayerModal() {
  if (playerModal) {
    playerModal.classList.add('hidden');
    playerModal.setAttribute('aria-hidden', 'true');
  }
  if (moviePlayer) {
    moviePlayer.pause();
    moviePlayer.removeAttribute('src');
    moviePlayer.load();
  }
}

// Data Fetching
async function fetchTags() {
  const mode = getCurrentMode();
  try {
    const data = await apiRequest(`/tags${mode === 'orange' ? '?mode=orange' : ''}`);
    if (data && Array.isArray(data.tags) && data.tags.length) {
      appState.tags = data.tags;
    }
  } catch (error) {
    const currentSet = new Set(appState.tags);
    (appState.videos || []).forEach((v) => (v.tags || []).forEach((t) => currentSet.add(t)));
    appState.tags = Array.from(currentSet);
  }
  renderCategoryList();
  renderUploadTagsPicker();
}

async function fetchVideos() {
  const mode = getCurrentMode();
  try {
    const data = await apiRequest(`/videos${mode === 'orange' ? '?mode=orange' : ''}`);
    appState.videos = (data.videos || []).map((video) => {
      let tags = video.tags;
      if (!tags || !Array.isArray(tags) || !tags.length) {
        tags = video.category ? [video.category] : [mode === 'orange' ? 'Adulte' : 'Films'];
      }
      return {
        id: video.id,
        userId: video.userId,
        title: video.title,
        tags: tags,
        src: video.src,
        quality: video.quality || '1080p',
        language: video.language || 'VF',
        sourceType: video.sourceType || 'user',
        createdAt: video.createdAt
      };
    });
  } catch (error) {
    appState.videos = [];
  }
  renderCategoryList();
  updateLibraryView();
}

async function loadCurrentUser() {
  try {
    const data = await apiRequest('/me');
    appState.user = data.user;
  } catch (error) {
    appState.user = null;
  }
  setAuthState();
  try {
    await fetchTags();
  } catch (e) {}
  try {
    await fetchVideos();
  } catch (e) {}
}

function setAuthState() {
  const isAdmin = Boolean(appState.user && appState.user.isAdmin);

  if (appState.user) {
    authStatus.textContent = `Connecté : ${appState.user.username}`;
    if (adminBadge) adminBadge.classList.toggle('hidden', !isAdmin);
    if (adminTagPanel) adminTagPanel.classList.toggle('hidden', !isAdmin);
    if (openAuthBtn) openAuthBtn.classList.add('hidden');
    if (logoutBtn) logoutBtn.classList.remove('hidden');
    if (uploadPanel) uploadPanel.classList.remove('hidden');
    closeAuthModal();
  } else {
    authStatus.textContent = 'Non connecté';
    if (adminBadge) adminBadge.classList.add('hidden');
    if (adminTagPanel) adminTagPanel.classList.add('hidden');
    if (openAuthBtn) openAuthBtn.classList.remove('hidden');
    if (logoutBtn) logoutBtn.classList.add('hidden');
    if (uploadPanel) uploadPanel.classList.add('hidden');
  }

  renderCategoryList();
}

// Global functions for direct onsubmit / onclick handlers
async function handleLogin(event) {
  if (event) event.preventDefault();
  const usernameInput = document.getElementById('loginUsername');
  const passwordInput = document.getElementById('loginPassword');
  const submitBtn = loginForm ? loginForm.querySelector('button[type="submit"]') : null;

  const username = (usernameInput ? usernameInput.value : '').trim();
  const password = passwordInput ? passwordInput.value : '';

  if (!username || !password) {
    showMessage('loginMessage', 'Veuillez remplir tous les champs.', 'error');
    return false;
  }

  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = 'Connexion en cours...';
  }

  try {
    const data = await apiRequest('/login', {
      method: 'POST',
      body: JSON.stringify({ username, password })
    });
    appState.user = data.user;
    setAuthState();
    if (loginForm) loginForm.reset();
    closeAuthModal();
  } catch (error) {
    let msg = 'Identifiants incorrects.';
    if (error.message && error.message !== 'uncrrct_lgn') {
      msg = `Erreur : ${error.message}`;
    }
    showMessage('loginMessage', msg, 'error');
    return false;
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Se connecter';
    }
  }

  try { await fetchTags(); } catch (e) {}
  try { await fetchVideos(); } catch (e) {}
  return false;
}

async function handleRegister(event) {
  if (event) event.preventDefault();
  const usernameInput = document.getElementById('registerUsername');
  const passwordInput = document.getElementById('registerPassword');
  const submitBtn = registerForm ? registerForm.querySelector('button[type="submit"]') : null;

  const username = (usernameInput ? usernameInput.value : '').trim();
  const password = passwordInput ? passwordInput.value : '';

  if (username.length < 3) {
    showMessage('registerMessage', 'Le nom d’utilisateur doit faire au moins 3 caractères.', 'error');
    return false;
  }
  if (password.length < 4) {
    showMessage('registerMessage', 'Le mot de passe doit faire au moins 4 caractères.', 'error');
    return false;
  }

  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = 'Création en cours...';
  }

  try {
    const data = await apiRequest('/register', {
      method: 'POST',
      body: JSON.stringify({ username, password })
    });
    appState.user = data.user;
    setAuthState();
    if (registerForm) registerForm.reset();
    closeAuthModal();
  } catch (error) {
    let msg = 'Erreur lors de la création du compte.';
    if (error.message === 'accnt_alrdy_exst') {
      msg = `Ce nom d'utilisateur (${username}) existe déjà. Choisissez un autre nom ou connectez-vous.`;
    } else if (error.message === 'usrnm_t_shrt') {
      msg = 'Le nom d’utilisateur doit comporter au moins 3 caractères.';
    } else if (error.message === 'psswd_t_shrt') {
      msg = 'Le mot de passe doit comporter au moins 4 caractères.';
    } else if (error.message) {
      msg = `Erreur : ${error.message}`;
    }
    showMessage('registerMessage', msg, 'error');
    return false;
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Créer le compte';
    }
  }

  try { await fetchTags(); } catch (e) {}
  try { await fetchVideos(); } catch (e) {}
  return false;
}

async function toggleOrangeMode() {
  const current = getCurrentMode();
  const nextMode = current === 'orange' ? 'default' : 'orange';
  localStorage.setItem('vplay_mode', nextMode);
  applyThemeAndBrand();
  showModeToast(nextMode === 'orange' ? 'Mode Orange activé (V2)' : 'Mode standard activé');
  appState.activeTag = 'all';
  appState.tags = nextMode === 'orange'
    ? ['Adulte', 'Charme', 'XXX', 'Amateur', 'Hentai', 'Parodie', 'VR', 'Autre']
    : ['Action', 'Animation', 'Aventure', 'Comédie', 'Documentaire', 'Drame', 'Fantastique', 'Horreur', 'Policier', 'Sci-Fi', 'Séries', 'Thriller', 'Films', 'Autre'];
  appState.selectedUploadTags = new Set([nextMode === 'orange' ? 'Adulte' : 'Films']);
  renderUploadTagsPicker();
  await fetchTags();
  await fetchVideos();
}

// Global window exposure
window.openAuthModal = openAuthModal;
window.closeAuthModal = closeAuthModal;
window.setAuthMode = setAuthMode;
window.handleLogin = handleLogin;
window.handleRegister = handleRegister;
window.openEditTagsModal = openEditTagsModal;
window.closeEditTagsModal = closeEditTagsModal;
window.openPlayerModal = openPlayerModal;
window.closePlayerModal = closePlayerModal;
window.toggleOrangeMode = toggleOrangeMode;

// Event Listeners
const addMovieBtn = document.getElementById('addMovieBtn');
if (addMovieBtn) {
  addMovieBtn.addEventListener('click', (e) => {
    if (!appState.user) {
      e.preventDefault();
      openAuthModal('login');
      showMessage('loginMessage', 'Veuillez vous connecter pour ajouter un film.', '');
    }
  });
}

let lastLoginClick = 0;
let loginClickTimer = null;

function handleLoginButtonClick(e) {
  if (e) e.preventDefault();
  const now = Date.now();
  if (now - lastLoginClick < 350) {
    if (loginClickTimer) {
      clearTimeout(loginClickTimer);
      loginClickTimer = null;
    }
    lastLoginClick = 0;
    closeAuthModal();
    toggleOrangeMode();
  } else {
    lastLoginClick = now;
    if (loginClickTimer) clearTimeout(loginClickTimer);
    loginClickTimer = setTimeout(() => {
      loginClickTimer = null;
      openAuthModal('login');
    }, 280);
  }
}

if (openAuthBtn) {
  openAuthBtn.addEventListener('click', handleLoginButtonClick);
  openAuthBtn.addEventListener('dblclick', (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (loginClickTimer) {
      clearTimeout(loginClickTimer);
      loginClickTimer = null;
    }
    closeAuthModal();
    toggleOrangeMode();
  });
}

const authStatusContainer = document.querySelector('.auth-status-container');
if (authStatusContainer) {
  let lastAuthClick = 0;
  authStatusContainer.addEventListener('click', () => {
    const now = Date.now();
    if (now - lastAuthClick < 350) {
      lastAuthClick = 0;
      toggleOrangeMode();
    } else {
      lastAuthClick = now;
    }
  });
  authStatusContainer.addEventListener('dblclick', (e) => {
    e.preventDefault();
    toggleOrangeMode();
  });
}

if (closeAuthBtn) {
  closeAuthBtn.addEventListener('click', closeAuthModal);
}

if (authModal) {
  authModal.addEventListener('click', (event) => {
    if (event.target === authModal) {
      closeAuthModal();
    }
  });
}

if (loginTab) {
  loginTab.addEventListener('click', () => setAuthMode('login'));
}

if (registerTab) {
  registerTab.addEventListener('click', () => setAuthMode('register'));
}

if (loginForm) {
  loginForm.addEventListener('submit', handleLogin);
}

if (registerForm) {
  registerForm.addEventListener('submit', handleRegister);
}

if (movieSearch) {
  movieSearch.addEventListener('input', (event) => {
    appState.searchQuery = event.target.value;
    updateLibraryView();
  });
}

// Admin add tag form
if (addTagForm) {
  addTagForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const tag = newTagInput.value.trim();
    if (!tag) return;

    try {
      const mode = getCurrentMode();
      await apiRequest(`/tags${mode === 'orange' ? '?mode=orange' : ''}`, {
        method: 'POST',
        body: JSON.stringify({ tag })
      });
      newTagInput.value = '';
      showMessage('tagMessage', 'Tag ajouté avec succès.', 'success');
      await fetchTags();
    } catch (error) {
      if (!appState.tags.some((t) => t.toLowerCase() === tag.toLowerCase())) {
        appState.tags.push(tag);
        appState.tags.sort((a, b) => a.localeCompare(b, 'fr'));
        renderCategoryList();
        renderUploadTagsPicker();
      }
      newTagInput.value = '';
      showMessage('tagMessage', 'Tag ajouté.', 'success');
    }
  });
}

// Edit Tags modal form
if (editTagsForm) {
  editTagsForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!appState.editingVideo) return;

    const selectedTags = Array.from(appState.selectedEditTags);
    const customTags = (editTagsCustom.value || '')
      .split(',')
      .map((t) => t.trim())
      .filter((t) => t.length > 0);

    const fallbackTag = getCurrentMode() === 'orange' ? 'Adulte' : 'Films';
    const combinedTags = [...new Set([...selectedTags, ...customTags])];
    if (!combinedTags.length) combinedTags.push(fallbackTag);

    try {
      await apiRequest(`/videos/${appState.editingVideo.id}/tags`, {
        method: 'POST',
        body: JSON.stringify({ tags: combinedTags })
      });
      closeEditTagsModal();
      await fetchTags();
      await fetchVideos();
    } catch (error) {
      showMessage('editTagsMessage', 'Erreur lors de la mise à jour des tags.', 'error');
    }
  });
}

if (closeEditTagsBtn) {
  closeEditTagsBtn.addEventListener('click', closeEditTagsModal);
}

if (editTagsModal) {
  editTagsModal.addEventListener('click', (event) => {
    if (event.target === editTagsModal) {
      closeEditTagsModal();
    }
  });
}

// Upload
if (uploadForm) {
  uploadForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!appState.user) {
      showMessage('uploadMessage', 'Tu dois être connecté pour uploader une vidéo.', 'error');
      return;
    }

    const file = document.getElementById('videoFile').files[0];
    const title = document.getElementById('videoTitle').value.trim() || 'Vidéo perso';
    const quality = document.getElementById('videoQuality').value;
    const language = document.getElementById('videoLanguage').value;

    const selectedTags = Array.from(appState.selectedUploadTags);
    const customTags = (videoTagsCustom.value || '')
      .split(',')
      .map((t) => t.trim())
      .filter((t) => t.length > 0);

    const fallbackTag = getCurrentMode() === 'orange' ? 'Adulte' : 'Films';
    const combinedTags = [...new Set([...selectedTags, ...customTags])];
    if (!combinedTags.length) combinedTags.push(fallbackTag);
    const primaryCategory = combinedTags[0] || fallbackTag;

    const videoExtensions = ['.mp4', '.mkv', '.avi', '.mov', '.webm', '.m4v', '.mpeg', '.mpg', '.wmv', '.flv', '.ts', '.m2ts'];
    const fileExt = file && file.name ? file.name.slice(file.name.lastIndexOf('.')).toLowerCase() : '';
    const isVideo = file && (file.type.startsWith('video/') || videoExtensions.includes(fileExt));

    if (!file || !isVideo) {
      showMessage('uploadMessage', 'Choisis une vidéo valide.', 'error');
      return;
    }

    isUploading = true;
    showMessage('uploadMessage', 'Préparation de l’upload...', '');

    const CHUNK_SIZE = 20 * 1024 * 1024; // 20 Mo
    const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
    const uploadId = 'up_' + Date.now() + '_' + Math.random().toString(36).substring(2, 10);

    try {
      for (let i = 0; i < totalChunks; i++) {
        const start = i * CHUNK_SIZE;
        const end = Math.min(start + CHUNK_SIZE, file.size);
        const chunkBlob = file.slice(start, end);

        const chunkData = new FormData();
        chunkData.append('uploadId', uploadId);
        chunkData.append('chunkIndex', i);
        chunkData.append('totalChunks', totalChunks);
        chunkData.append('filename', file.name);
        chunkData.append('title', title);
        chunkData.append('category', primaryCategory);
        chunkData.append('tags', JSON.stringify(combinedTags));
        chunkData.append('mode', getCurrentMode());
        chunkData.append('quality', quality);
        chunkData.append('language', language);
        chunkData.append('chunk', chunkBlob, file.name);

        showMessage('uploadMessage', `Envoi du film : paquet ${i + 1}/${totalChunks}...`, '');

        const res = await fetch(`${apiBase}/videos/chunk`, {
          method: 'POST',
          credentials: 'same-origin',
          body: chunkData
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || `Erreur sur le paquet ${i + 1}`);
        }
      }

      isUploading = false;
      showMessage('uploadMessage', `Vidéo publié avec succès : ${title}`, 'success');
      uploadForm.reset();
      appState.selectedUploadTags = new Set([getCurrentMode() === 'orange' ? 'Adulte' : 'Films']);
      renderUploadTagsPicker();
      appState.activeTag = 'all';
      await fetchTags();
      await fetchVideos();
    } catch (error) {
      isUploading = false;
      showMessage('uploadMessage', error.message || 'Erreur lors de l’enregistrement de la vidéo.', 'error');
    }
  });
}

// Logout
if (logoutBtn) {
  logoutBtn.addEventListener('click', async () => {
    try {
      await apiRequest('/logout', { method: 'POST' });
    } catch (error) {
      // dnothing
    }
    appState.user = null;
    appState.activeTag = 'all';
    setAuthState();
    await fetchTags();
    await fetchVideos();
    showMessage('uploadMessage', '', '');
  });
}

if (closePlayerBtn) {
  closePlayerBtn.addEventListener('click', closePlayerModal);
}

if (playerModal) {
  playerModal.addEventListener('click', (event) => {
    if (event.target === playerModal) {
      closePlayerModal();
    }
  });
}

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    closeAuthModal();
    closeEditTagsModal();
    closePlayerModal();
  }
});

// Initialization
applyThemeAndBrand();
setAuthMode('login');
setAuthState();
loadCurrentUser();
