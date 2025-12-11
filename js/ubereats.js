(function(){
  const CSV_URL = '../data/ubereats.csv';

  // --------- Utils ---------
  const num  = v => (v===null||v===undefined||v==='') ? NaN : +String(v).trim().replace(',', '.');
  const fmt  = n => new Intl.NumberFormat('es-MX',{maximumFractionDigits:0}).format(n);
  const fmt1 = n => new Intl.NumberFormat('es-MX',{maximumFractionDigits:1}).format(n);

  // Normalizador de texto
  // Helpers de normalización --------------------------
const deacc = s => String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'');
const norm  = s => deacc(s).toLowerCase().replace(/[\/,.-]/g,' ').replace(/\s+/g,' ').trim();

// Diccionario de equivalencias (ES/EN) --------------
// Puedes añadir más pares sin miedo.
const CAT_MAP = [
  // comida “rápida”
  [['american','americana','comida americana','fast food'], 'americana'],
  [['chinese','china','comida china'],                        'china'],
  [['japanese','japonesa','comida japonesa'],                'japonesa'],
  [['italian','italiana','comida italiana'],                 'italiana'],
  [['mexican','mexicana','comida mexicana'],                 'mexicana'],
  [['indian','india','hindú'],                               'india'],
  [['korean','coreana'],                                     'coreana'],
  [['thai','tailandesa'],                                    'tailandesa'],
  [['vietnamese','vietnamita'],                              'vietnamita'],

  // grupos frecuentes
  [['burger','burgers','hamburguesa','hamburguesas'],        'hamburguesas'],
  [['pizza','pizzas'],                                       'pizza'],
  [['taco','tacos'],                                         'tacos'],
  [['sushi'],                                                'sushi'],
  [['chicken','pollo','alitas'],                             'pollo'],
  [['sandwich','sandwiches','sándwich','sándwiches','salad sandwiches','salad sandwich'], 'sándwiches'],
  [['coffee','cafe','cafeteria','cafetería'],                'café'],
  [['dessert','postre','pasteleria','pastelería','reposteria','repostería'], 'postres'],
  [['seafood','mariscos','marisco'],                         'mariscos'],
  [['vegan','vegana','vegetariana','vegetarian'],            'vegana/vegetariana'],
  [['ramen'],                                                'ramen'],
];

function collapseCat(raw){
  const x = norm(raw||'');
  if (!x) return 'Sin categoría';
  for (const [aliases, target] of CAT_MAP){
    if (aliases.some(a => x.includes(a))) return target;
  }
  return raw || 'Sin categoría';
}

  // Mapa (Leaflet)
  let map, heatLayer, pointsLayer;
  function ensureMap(){
    if (map) return;
    map = L.map('map', { zoomControl: true, attributionControl: false });
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',{maxZoom:19}).addTo(map);
  }
  function fitTo(points){
    if (!points.length){ map.setView([19.43,-99.13], 4); return; }
    map.fitBounds(L.latLngBounds(points).pad(0.12));
  }

  // Histograma simple
  function makeHistogram(values, min, max, step){
    const centers=[], counts=[];
    for(let x=min+step/2; x<=max+1e-9; x+=step){ centers.push(+x.toFixed(2)); counts.push(0); }
    for(const v of values){ const idx=Math.floor((v-min)/step); if(idx>=0 && idx<counts.length) counts[idx]++; }
    return {centers, counts};
  }
  function countBy(arr, keyFn){ const m=new Map(); for(const r of arr){const k=keyFn(r); m.set(k,(m.get(k)||0)+1);} return m; }
  function layout(xTitle, rotate=false){
    return {
      margin:{t:10,r:10,b:rotate?60:40,l:40},
      paper_bgcolor:'rgba(0,0,0,0)', plot_bgcolor:'rgba(0,0,0,0)',
      xaxis:{title:xTitle, gridcolor:'#223252', tickangle: rotate? -20:0},
      yaxis:{gridcolor:'#223252'}
    };
  }

  // Carga CSV (autodetect y reintento con ;)
  function loadCsv(delimiter){
    return new Promise(resolve=>{
      Papa.parse(CSV_URL, {
        download:true, header:true, skipEmptyLines:'greedy', delimiter: delimiter||'',
        complete: res => resolve(res), error: _ => resolve({data:[]})
      });
    });
  }

  (async function init(){
    let res = await loadCsv('');
    if (!res.data || !res.data.length || Object.keys(res.data[0]||{}).length<=1){
      res = await loadCsv(';');
    }
    const data = res.data.filter(r=>r && Object.keys(r).length);

    // Encabezados esperados (con sus variantes)
    const H = {
      nombre:   Object.keys(data[0]||{}).find(h => /nombre|name/i.test(deacc(h))) || 'Nombre',
      categoria:Object.keys(data[0]||{}).find(h => /categor(i|)a|category|tipo/i.test(deacc(h))) || 'Categoría',
      calif:    Object.keys(data[0]||{}).find(h => /calificaci(o|)n|rating|score/i.test(deacc(h))) || 'Calificación',
      opin:     Object.keys(data[0]||{}).find(h => /opiniones|reviews|rese(n|)as/i.test(deacc(h))) || 'Número de Opiniones',
      dir:      Object.keys(data[0]||{}).find(h => /direccion|address/i.test(deacc(h))) || 'Dirección',
      lat:      Object.keys(data[0]||{}).find(h => /^lat(itud)?$/i.test(deacc(h))) || 'Latitud',
      lon:      Object.keys(data[0]||{}).find(h => /^(lon(gitud)?|lng)$/i.test(deacc(h))) || 'Longitud',
      img:      Object.keys(data[0]||{}).find(h => /imagen|image|foto|photo|thumb/i.test(deacc(h))) || 'Imagen'
    };

    const rows = data.filter(r=>r[H.nombre]).map(r=>({
      nombre:  r[H.nombre],
      cat:     collapseCat(r[H.categoria]),
      rating:  num(r[H.calif]),
      reviews: num(r[H.opin]),
      dir:     r[H.dir] || '',
      lat:     num(r[H.lat]),
      lon:     num(r[H.lon]),
      img:     r[H.img] || ''
    }));

    // ----- Filtros: valores iniciales y eventos -----
    const sel = document.getElementById('categorySelect');
    const cats = [...new Set(rows.map(r=>r.cat))].sort();
    sel.innerHTML = '<option value="__ALL__">(Todas)</option>'+cats.map(c=>`<option value="${c}">${c}</option>`).join('');
        cats.map(c=>`<option value="${c}">${c}</option>`).join('');
        
    const minRatingInput  = document.getElementById('minRating');
    const minReviewsInput = document.getElementById('minReviews');
    // Por defecto mostrar TODO
    minRatingInput.value = 0;
    minReviewsInput.value = 0;

    ['change','input'].forEach(ev=>{
      sel.addEventListener(ev, update);
      minRatingInput.addEventListener(ev, update);
      minReviewsInput.addEventListener(ev, update);
    });
    document.getElementById('applyFilters').addEventListener('click', update);

    // ----- Render principal -----
    function update(){
      const cat  = sel.value;
      const minR = minRatingInput.valueAsNumber || 0;
      const minN = minReviewsInput.valueAsNumber || 0;

      // Si faltan rating/opiniones, las incluimos cuando el umbral es 0
      const filtered = rows.filter(r=>{
        const passCat  = (cat==='__ALL__' || r.cat===cat);
        const passRat  = isFinite(r.rating) ? r.rating  >= minR : (minR <= 0);
        const passRev  = isFinite(r.reviews)? r.reviews >= minN : (minN <= 0);
        return passCat && passRat && passRev;
      });

      if (!filtered.length) {
  // KPIs a cero
  setText('kpiOrders', '0');
  setText('kpiAvg',    '—');
  setText('kpiCats',   '0');

  // Gráfico vacío con mensaje
  const emptyAnn = (txt) => ({
    margin:{t:10,r:10,b:40,l:40},
    paper_bgcolor:'rgba(0,0,0,0)', plot_bgcolor:'rgba(0,0,0,0)',
    xaxis:{visible:false}, yaxis:{visible:false},
    annotations:[{text:txt, x:0.5,y:0.5, xref:'paper', yref:'paper', showarrow:false}]
  });
  Plotly.react('chartTime', [], emptyAnn('Sin datos para los filtros actuales'));
  Plotly.react('chartCats', [], emptyAnn('Sin datos para los filtros actuales'));

  // Mapa: limpiar capas y centrar vista
  ensureMap();
  if (heatLayer) map.removeLayer(heatLayer);
  if (pointsLayer) map.removeLayer(pointsLayer);
  map.setView([19.43, -99.13], 4); // MX por defecto

  return; // <-- muy importante
}


      // KPIs
      const ratings = filtered.map(r=>r.rating).filter(isFinite);
      const reviews = filtered.map(r=>r.reviews).filter(isFinite);
      const avgRating = ratings.length ? ratings.reduce((a,b)=>a+b,0)/ratings.length : NaN;

      setText('kpiOrders', fmt(filtered.length));
      setText('kpiAvg',    isFinite(avgRating)? fmt1(avgRating) : '—');
      setText('kpiCats',   fmt(new Set(filtered.map(r=>r.cat)).size));

      // Gráficos
      const bins = makeHistogram(ratings, 0, 5, 0.5);
      Plotly.react('chartTime', [{
        x: bins.centers, y: bins.counts, type:'bar',
        hovertemplate:'Calificación %{x}<br>Restaurantes: %{y}<extra></extra>'
      }], layout('Calificación'));

      const counts = countBy(filtered, r=>r.cat);
      const top = [...counts.entries()].sort((a,b)=>b[1]-a[1]).slice(0,10);
      Plotly.react('chartCats', [{
        x: top.map(t=>t[0]), y: top.map(t=>t[1]), type:'bar',
        hovertemplate:'%{x}<br>Restaurantes: %{y}<extra></extra>'
      }], layout('Categorías', true));

      // Mapa
      ensureMap();
      const pts = filtered.filter(r=>isFinite(r.lat)&&isFinite(r.lon)).map(r=>[r.lat,r.lon]);
      fitTo(pts);

      if (heatLayer) map.removeLayer(heatLayer);
      if (pointsLayer) map.removeLayer(pointsLayer);

      const maxRev = reviews.length ? Math.max(...reviews) : 1;
      const heatData = filtered
        .filter(r=>isFinite(r.lat)&&isFinite(r.lon))
        .map(r=>[r.lat, r.lon, Math.max(0.2, Math.min(1, (r.reviews||0)/maxRev))]);

      heatLayer = L.heatLayer(heatData, {radius:20, blur:15, maxZoom:17});
      pointsLayer = L.layerGroup(
        filtered.filter(r=>isFinite(r.lat)&&isFinite(r.lon)).map(r=>{
          const m = L.circleMarker([r.lat, r.lon], {
            radius:4, color:'#6ea8fe', weight:1, fillColor:'#6ea8fe', fillOpacity:.8
          });
          const img = r.img ? `<div style="margin-top:6px"><img src="${r.img}" alt="" style="max-width:160px;border-radius:8px">` : '';
          m.bindPopup(`<strong>${esc(r.nombre)}</strong><br>${esc(r.cat)} · ⭐ ${isFinite(r.rating)?fmt1(r.rating):'—'} · ${fmt(r.reviews)} opiniones<br>${esc(r.dir)}${img}`);
          return m;
        })
      );

      // Vista por defecto
      heatLayer.addTo(map);
      document.getElementById('btnHeat')  ?.addEventListener('click', ()=>{ pointsLayer.remove(); heatLayer.addTo(map); });
      document.getElementById('btnPoints')?.addEventListener('click', ()=>{ heatLayer.remove(); pointsLayer.addTo(map); });
    }

    function setText(id, v){ const el=document.getElementById(id); if (el) el.textContent = v; }

    // Render inicial (con todo a 0) → muestra datos por defecto
    update();
  })();

  // helper: escapar HTML seguro
function esc(s){
  return String(s).replace(/[&<>"']/g, ch => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[ch]));
}

})();   // <-- solo uno

