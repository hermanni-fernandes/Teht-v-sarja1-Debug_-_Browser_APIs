'use strict';

// 0) Pieni apu
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

// 1) Teema — LocalStorage-avain + yksittäinen kuuntelija
const themeBtn = $('#themeToggle');
const THEME_KEY = 'theme-preference';
function applyTheme(t) { document.documentElement.setAttribute('data-theme', t); }
function saveTheme(t) { localStorage.setItem(THEME_KEY, t); }
function loadTheme() { return localStorage.getItem(THEME_KEY) || 'light'; }
function toggleTheme() {
  const next = (loadTheme() === 'light') ? 'dark' : 'light';
  applyTheme(next);
  saveTheme(next);
}
themeBtn.addEventListener('click', toggleTheme);
applyTheme(loadTheme());

/* --- Toast helper for small status banners --- */
function showToast(msg, type = 'success') {
  const el = document.createElement('div');
  el.className = `toast toast--${type}`;
  el.textContent = msg;
  document.body.appendChild(el);
  // fade in
  requestAnimationFrame(() => { el.style.opacity = '1'; });
  // auto hide after 2s
  setTimeout(() => {
    el.style.opacity = '0';
    setTimeout(() => el.remove(), 200);
  }, 2000);
}

// 2) Haku — vaihda hakua tukevaan API:in + try/catch + AbortController + lataustila
const form = document.getElementById('searchForm');
const resultsEl = document.getElementById('results');
const statusEl = document.getElementById('status');

let searchController = null; // perumista varten

// DummyJSON: https://dummyjson.com/docs/products#search
async function searchImages(query, { signal } = {}) {
  const url = `https://dummyjson.com/products/search?q=${encodeURIComponent(query)}`;

  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  const data = await res.json();
  const arr = Array.isArray(data?.products) ? data.products : [];

  // Muotoile UI:lle sopivaksi
  return arr.slice(0, 8).map(p => ({
    title: p.title || query,
    url: p.thumbnail || (p.images && p.images[0]) || ''
  }));
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();

  const q = $('#q').value.trim();
  resultsEl.innerHTML = '';

  if (!q) {
    statusEl.textContent = 'Anna hakusana';
    return;
  }

  // Peru aiempi haku, jos käynnissä
  if (searchController) searchController.abort();
  searchController = new AbortController();

  statusEl.textContent = 'Ladataan...';

  try {
    const items = await searchImages(q, { signal: searchController.signal });

    if (items.length === 0) {
      statusEl.textContent = 'Ei tuloksia';
      return;
    }

    items.forEach(item => {
      const li = document.createElement('li');
      li.className = 'card';
      li.innerHTML = `<strong>${item.title}</strong><br><img alt="" width="160" src="${item.url}">`;
      resultsEl.appendChild(li);
    });

    statusEl.textContent = `${items.length} tulosta`;
  } catch (err) {
    if (err.name === 'AbortError') {
      statusEl.textContent = 'Haku peruttu (uusi haku käynnissä)';
    } else {
      console.error('Virhe haussa:', err);
      statusEl.textContent = 'Virhe haussa';
    }
  } finally {
    searchController = null; // tämä haku on valmis (onnistui, epäonnistui tai peruttiin)
  }
});

// 3) Laskuri — korjaus: klikkaus missä tahansa napissa kasvattaa lukua
const counterBtn = $('.counter');
counterBtn.addEventListener('click', (e) => {
  // valitse aina itse nappi riippumatta klikatusta childista
  const btn = e.target.closest('.counter');
  if (!btn) return;
  const span = $('.count', btn);
  span.textContent = String(parseInt(span.textContent, 10) + 1);
});

// 4) Clipboard — HTTPS/permission-tarkistus + virheenkäsittely + 2s toast (ei alertia)
$('#copyBtn').addEventListener('click', async () => {
  const text = $('#copyBtn').dataset.text || '';

  // Secure context check: HTTPS tai localhost/127.0.0.1
  const isSecure =
    location.protocol === 'https:' ||
    location.hostname === 'localhost' ||
    location.hostname === '127.0.0.1';

  if (!isSecure) {
    showToast('Leikepöytä vaatii HTTPSin tai localhostin', 'error');
    return;
  }

  try {
    // Permission (parhaan kyvyn mukaan; ei kaikissa selaimissa)
    const perm = await navigator.permissions?.query?.({ name: 'clipboard-write' });
    if (perm && perm.state === 'denied') {
      showToast('Ei oikeuksia leikepöydälle', 'error');
      return;
    }

    await navigator.clipboard.writeText(text);
    showToast('Kopioitu', 'success');
  } catch (err) {
    console.error('Clipboard error:', err);
    showToast('Kopiointi epäonnistui', 'error');
  }
});

// 5) IntersectionObserver — threshold 0.25, tee "Näkyvissä!" vain kerran ja siivoa
const box = document.querySelector('.observe-box');

const io = new IntersectionObserver((entries, observer) => {
  for (const entry of entries) {
    // callback laukeaa, kun raja 0.25 ylittyy → riittää tarkistaa isIntersecting
    if (entry.isIntersecting) {
      box.textContent = 'Näkyvissä!';
      // Vain kerran: lopetetaan tarkkailu ja vapautetaan observer
      observer.unobserve(entry.target);
      observer.disconnect();
      break;
    }
  }
}, { threshold: 0.25 });
io.observe(box);
