// Import the main Firebase App
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.12.1/firebase-app.js";

// Import Firestore and the offline tools
import { 
  getFirestore,
  initializeFirestore, 
  persistentLocalCache, 
  persistentMultipleTabManager, 
  collection, 
  addDoc, 
  onSnapshot, 
  doc, 
  updateDoc,
  getDocs,
  deleteDoc, 
  query,
  where,
  setDoc,
  serverTimestamp,
  orderBy 
} from "https://www.gstatic.com/firebasejs/12.12.1/firebase-firestore.js";


// Firebase Config                        
const firebaseConfig = {
  apiKey: "AIzaSyDAFoz0SUCuYee4LECnTah7P9mrsmasoZw",
  authDomain: "restaurant-recommendatio-c31ce.firebaseapp.com",
  projectId: "restaurant-recommendatio-c31ce",
  storageBucket: "restaurant-recommendatio-c31ce.firebasestorage.app",
  messagingSenderId: "797081015138",
  appId: "1:797081015138:web:56bc327844dd7582bb523b"
  };

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Single shared document — everyone reads & writes here
const favouritesDoc = doc(db, "shared", "favourites");

// UI helpers
const syncIndicator = document.getElementById('syncIndicator');
const syncText = document.getElementById('syncText');
let syncTimer;

function showSync(text, isError = false) {
  syncText.textContent = text;
  syncIndicator.classList.toggle('error', isError);
  syncIndicator.classList.add('visible');
  clearTimeout(syncTimer);
  if (!isError) {
    syncTimer = setTimeout(() => syncIndicator.classList.remove('visible'), 1800);
  }
}






// Dark mode secure
(function() {
  try {
    var stored = localStorage.getItem('theme');
    var systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    var theme = stored || (systemDark ? 'dark' : 'light');
    document.documentElement.setAttribute('data-theme', theme);
  } catch(e) {
    document.documentElement.setAttribute('data-theme', 'light');
  }
})();



// State
let currentFilter = 'all';
let localFavourites = {}; // { 'jade-garden': true, ... }
let isApplyingRemote = false;


// Sort restaurant cards by date added (newest first)
(function sortCardsByDateAdded() {
  const grid = document.getElementById('cardsGrid');
  if (!grid) return;

  const cardsToSort = Array.from(grid.querySelectorAll('.restaurant-card'));
  cardsToSort.sort((a, b) => {
    return new Date(b.dataset.added) - new Date(a.dataset.added);
  });

// Double Check the date added
  cardsToSort.sort((a, b) => {
  const dateA = new Date(a.dataset.added || 0);
  const dateB = new Date(b.dataset.added || 0);
  return dateB - dateA;
});
  
  cardsToSort.forEach(card => grid.appendChild(card));
})();



const cards = document.querySelectorAll('.restaurant-card');
const filterButtons = document.querySelectorAll('.filter-btn');

// Render hearts from state
function renderFavourites() {
  cards.forEach(card => {
    const id = card.dataset.id;
    const btn = card.querySelector('.fav-toggle');
    const icon = btn.querySelector('i');
    const isFav = !!localFavourites[id];

    btn.classList.toggle('active', isFav);
    if (isFav) {
      icon.classList.remove('fa-regular');
      icon.classList.add('fa-solid');
    } else {
      icon.classList.remove('fa-solid');
      icon.classList.add('fa-regular');
    }
  });
  updateFavCounts();
  if (currentFilter === 'favourites') applyFilter();
}

function updateFavCounts() {
  const count = Object.values(localFavourites).filter(Boolean).length;
  document.getElementById('slimFavCount').textContent = count;
  document.getElementById('heroFavCount').textContent = count;
  document.getElementById('filterFavCount').textContent = count;
}

// Real-time listener
showSync('Connecting…');
onSnapshot(favouritesDoc, (snap) => {
  const data = snap.data();
  localFavourites = (data && data.items) ? data.items : {};
  isApplyingRemote = true;
  renderFavourites();
  isApplyingRemote = false;
  showSync('Synced ♡');
}, (err) => {
  console.error('Firestore error:', err);
  showSync('Offline — changes won\'t sync', true);
});

// Write to Firestore on tap
async function toggleFavourite(id, btn) {
  const newValue = !localFavourites[id];
  // Optimistic UI: flip immediately so it feels instant
  localFavourites = { ...localFavourites, [id]: newValue };
  renderFavourites();
  if (newValue) {
    btn.classList.add('just-favourited');
    setTimeout(() => btn.classList.remove('just-favourited'), 400);
  }

  try {
    // merge:true means only update this one key, not overwrite the whole doc
    await setDoc(favouritesDoc, {
      items: { [id]: newValue },
      updatedAt: serverTimestamp()
    }, { merge: true });
  } catch (err) {
    console.error('Save failed:', err);
    // Roll back on failure
    localFavourites = { ...localFavourites, [id]: !newValue };
    renderFavourites();
    showSync('Couldn\'t save — try again', true);
  }
}

// Wire up buttons (and enable them now that Firebase is loaded)
document.querySelectorAll('.fav-toggle').forEach(btn => {
  btn.disabled = false;
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    const card = btn.closest('.restaurant-card');
    toggleFavourite(card.dataset.id, btn);
  });
});

// Filtering
function applyFilter() {
  let visibleCount = 0;
  cards.forEach(card => {
    let show = false;
    if (currentFilter === 'all') {
      show = true;
    } else if (currentFilter === 'favourites') {
      show = !!localFavourites[card.dataset.id];
    } else {
      show = card.dataset.category === currentFilter;
    }
    card.style.display = show ? '' : 'none';
    if (show) visibleCount++;
  });

  const grid = document.getElementById('cardsGrid');
  let emptyEl = grid.querySelector('.empty-state');
  if (visibleCount === 0) {
    if (!emptyEl) {
      emptyEl = document.createElement('div');
      emptyEl.className = 'empty-state';
      emptyEl.innerHTML = '<i class="fa-regular fa-heart"></i><p>No favourites yet — tap the heart on any place you love.</p>';
      grid.appendChild(emptyEl);
    }
  } else if (emptyEl) {
    emptyEl.remove();
  }
}

filterButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    filterButtons.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentFilter = btn.dataset.filter;
    applyFilter();
  });
});

document.querySelectorAll('[data-action="show-favourites"]').forEach(btn => {
  btn.addEventListener('click', () => {
    filterButtons.forEach(b => b.classList.toggle('active', b.dataset.filter === 'favourites'));
    currentFilter = 'favourites';
    applyFilter();
    document.querySelector('.filter-bar').scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
});


// Scroll bar for filter
const filterBar = document.querySelector('.filter-scroll');

if (filterBar) {
  filterBar.addEventListener('wheel', (e) => {
    if (filterBar.scrollWidth > filterBar.clientWidth) {
      e.preventDefault();
      filterBar.scrollLeft += e.deltaY;
    }
  }, { passive: false });
}

// Dark Mode
(function() {
  const toggle = document.getElementById('themeToggle');
  const meta = document.getElementById('theme-color-meta');
  const root = document.documentElement;

  function setTheme(theme) {
    root.setAttribute('data-theme', theme);
    try { localStorage.setItem('theme', theme); } catch(e) {}
    if (meta) {
      meta.setAttribute('content', theme === 'dark' ? '#0f1d33' : '#f5faff');
    }
  }

  toggle.addEventListener('click', () => {
    const current = root.getAttribute('data-theme');
    setTheme(current === 'dark' ? 'light' : 'dark');
  });

  // Respect OS changes only if user hasn't made an explicit choice
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
    if (!localStorage.getItem('theme')) {
        setTheme(e.matches ? 'dark' : 'light');
    }
  });
})();

// NON-FIREBASE UI SCRIPT
// Slim header reveal (independent of Firebase)
const slimHeader = document.getElementById('slimHeader');
const hero = document.getElementById('hero');

const observer = new IntersectionObserver(
  ([entry]) => {
    if (entry.intersectionRatio < 0.25) {
      slimHeader.classList.add('visible');
    } else {
      slimHeader.classList.remove('visible');
    }
  },
  { threshold: [0, 0.25, 0.5, 1] }
);
observer.observe(hero);