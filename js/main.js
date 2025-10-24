// Actualiza el año del footer automáticamente
document.getElementById('year').textContent = new Date().getFullYear();
// Ejemplo: marcar enlace activo al hacer scroll (simple y opcional)
// (Puedes borrar esto si no lo necesitas)
const links = document.querySelectorAll('nav.menu a');
const sections = [...links].map(a => document.querySelector(a.getAttribute('href'))).filter(Boolean);
const setActive = () => {
let idx = sections.findIndex(sec => sec.getBoundingClientRect().top - 80 > 0);
if (idx === -1) idx = sections.length - 1; else if (idx > 0) idx -= 1;
links.forEach(l => l.classList.remove('active'));
if (sections[idx]){
const id = '#' + sections[idx].id;
const current = [...links].find(l => l.getAttribute('href') === id);
if (current) current.classList.add('active');
}
};
window.addEventListener('scroll', setActive);
setActive();