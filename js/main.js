// --- Año en el footer (con guardia) ---
const yearEl = document.getElementById('year');
if (yearEl) yearEl.textContent = new Date().getFullYear();

// --- Scrollspy SOLO para enlaces con # (home) ---
const menuLinks = [...document.querySelectorAll('nav.menu a')];

// Solo anclas internas (#...) — ignora rutas como index.html o ../index.html
const anchorLinks = menuLinks.filter(a => {
  const h = a.getAttribute('href');
  return h && h.startsWith('#');
});

// Secciones a observar (si existen)
const sections = anchorLinks
  .map(a => document.querySelector(a.getAttribute('href')))
  .filter(Boolean);

function setActiveByScroll() {
  if (!sections.length) return; // nada que hacer si no hay secciones
  let idx = sections.findIndex(sec => sec.getBoundingClientRect().top - 80 > 0);
  if (idx === -1) idx = sections.length - 1;
  else if (idx > 0) idx -= 1;

  anchorLinks.forEach(l => l.classList.remove('active'));
  const sec = sections[idx];
  if (!sec) return;
  const target = '#' + sec.id;
  const current = anchorLinks.find(l => l.getAttribute('href') === target);
  if (current) current.classList.add('active');
}

// Activa solo si hay secciones (home)
if (sections.length) {
  window.addEventListener('scroll', setActiveByScroll, { passive: true });
  setActiveByScroll();
}

// --- Resaltado por ruta (subpáginas como /proyectos/ubereats.html) ---
(function markActiveByPath() {
  const path = location.pathname.replace(/\\/g, '/'); // normaliza
  menuLinks.forEach(a => {
    const href = a.getAttribute('href') || '';
    // Toma solo el archivo de la ruta: index.html, proyectos.html, ubereats.html, etc.
    const file = href.split('#')[0].split('/').pop();
    if (!file) return;
    if (path.endsWith('/' + file)) a.classList.add('active');
  });
})();
