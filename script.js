const KEY = 'calendario-examenes', TK = 'calendario-tema';
const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const DIAS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const TIPOS = { parcial: 'Parcial', final: 'Final', tp: 'TP', recordatorio: 'Recordatorio' };
let events = [];
const feriados = new Map(), consultasFeriados = new Set();
function cargarFeriados(year) {
    if (consultasFeriados.has(year)) return;
    consultasFeriados.add(year);
    const key = 'calendario-feriados-' + year;
    try {
        const cache = JSON.parse(localStorage.getItem(key));
        if (cache && Array.isArray(cache.data)) {
            feriados.set(year, cache.data);
            if (Date.now() - cache.time < 3 * 60 * 60 * 1000) return;
        }
    } catch (e) { }
    fetch('https://api.argentinadatos.com/v1/feriados/' + year)
        .then(r => { if (!r.ok) throw new Error('No se pudieron cargar los feriados'); return r.json() })
        .then(data => {
            if (!Array.isArray(data)) throw new Error('Respuesta inválida');
            const validos = data.filter(f => f && typeof f.nombre === 'string' && typeof f.fecha === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(f.fecha) && f.fecha.startsWith(year + '-'));
            feriados.set(year, validos);
            try { localStorage.setItem(key, JSON.stringify({ time: Date.now(), data: validos })) } catch (e) { }
            render();
        }).catch(() => { consultasFeriados.delete(year) });
}
const feriadosDelDia = date => (feriados.get(Number(date.slice(0, 4))) || []).filter(f => f.fecha === date);
try { events = JSON.parse(localStorage.getItem(KEY) || '[]'); if (!Array.isArray(events)) events = [] } catch (e) { events = [] }
events = events.filter(e => e && typeof e.date === 'string' && e.materia);
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(events)) } catch (e) { } };
const pad = n => String(n).padStart(2, '0');
const iso = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
const parse = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d) };
const cap = t => TIPOS[t] || 'Parcial';
const $ = id => document.getElementById(id);
const $$ = s => document.querySelectorAll(s);
function el(tag, cls, txt) { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e }
const diff = s => Math.round((parse(s) - parse(iso(new Date()))) / 864e5);
const cuando = n => n === 0 ? 'Hoy' : n === 1 ? 'Mañana' : n > 1 ? 'En ' + n + ' días' : n === -1 ? 'Ayer' : 'Hace ' + (-n) + ' días';
const fin = e => e.endDate || e.date;
const fechaPendiente = e => e.date < iso(new Date()) && fin(e) >= iso(new Date()) ? iso(new Date()) : e.date;
const estadoFecha = e => e.hecho ? 'Hecho' : e.endDate && diff(e.date) <= 0 && diff(e.endDate) >= 0 ? 'Hasta ' + parse(e.endDate).toLocaleDateString('es-AR') : cuando(diff(e.date));
const rangoTexto = e => e.endDate ? parse(e.date).toLocaleDateString('es-AR') + ' al ' + parse(e.endDate).toLocaleDateString('es-AR') : '';
const cuenta = e => {
    const n = diff(fechaPendiente(e));
    return el('span', 'countdown' + (!e.hecho && n >= 0 && n <= 3 ? ' soon' : '') + (!e.hecho && n < 0 ? ' past' : ''), estadoFecha(e));
};
const ord = (a, b) => (fechaPendiente(a) + (a.hora || '99')).localeCompare(fechaPendiente(b) + (b.hora || '99'));
const notasDe = e => Array.isArray(e.notas) ? e.notas : (e.nota ? [e.nota] : []);
const textoNotas = e => notasDe(e).join(' · ');
const pend = e => !e.hecho && diff(fin(e)) >= 0;
const F = { 0: '01110100011001110101110011000101110', 1: '00100011000010000100001000010001110', 2: '01110100010000100010001000100011111', 3: '11110000010000101110000010000111110', 4: '00010001100101010010111110001000010', 5: '11111100001111000001000011000101110', 6: '00110010001000011110100011000101110', 7: '11111000010001000100010000100001000', 8: '01110100011000101110100011000101110', 9: '01110100011000101111000010001001100' };
function dm(s) {
    const w = s.length * 6 - 1; let c = '';[...s].forEach((ch, i) => { for (let j = 0; j < 35; j++) { c += '<circle cx="' + (i * 6 + j % 5 + .5) + '" cy="' + (Math.floor(j / 5) + .5) + '" r=".36" ' + (F[ch][j] === '1' ? '' : 'opacity=".13" ') + '/>' } });
    const d = el('div', 'dm'); d.innerHTML = '<svg viewBox="0 0 ' + w + ' 7" fill="currentColor" aria-hidden="true">' + c + '</svg>'; d.setAttribute('role', 'img'); d.setAttribute('aria-label', s + (s === '1' ? ' día' : ' días')); return d
}
let view = new Date(); view.setDate(1);
let sel = iso(new Date());
const mob = () => matchMedia('(max-width:640px)').matches;
const tapDay = k => { if (mob()) { sel = k; render() } else openModal(null, k) };
let editing = null, filter = 'all', modo = 'mes', armed = false;
let scrollBeforeModal = 0;
function showOverlay(id) {
    if (!document.body.classList.contains('modal-open')) {
        scrollBeforeModal = window.scrollY;
        document.body.style.top = -scrollBeforeModal + 'px';
        document.body.classList.add('modal-open');
    }
    $(id).classList.add('open');
}

function render() {
    const y = view.getFullYear(), m = view.getMonth();
    const all = events.filter(e => filter === 'all' || e.type === filter);
    $('mes').replaceChildren(MESES[m] + ' ', el('span', 'yr', String(y)));
    const inicioMes = iso(new Date(y, m, 1)), finMes = iso(new Date(y, m + 1, 0));
    const mes = all.filter(e => e.date <= finMes && fin(e) >= inicioMes).sort(ord);
    const cnt = k => mes.filter(e => e.type === k).length, p = cnt('parcial'), f = cnt('final'), tp = cnt('tp');
    const rec = cnt('recordatorio');
    $('resumen').textContent = mes.length ? [p && p + (p === 1 ? ' parcial' : ' parciales'), f && f + (f === 1 ? ' final' : ' finales'), tp && tp + (tp === 1 ? ' TP' : ' TPs'), rec && rec + (rec === 1 ? ' recordatorio' : ' recordatorios')].filter(Boolean).join(', ') : 'Sin fechas este mes';

    const prox = events.filter(pend).sort(ord)[0], h = $('hero');
    if (prox) {
        const n = diff(fechaPendiente(prox)), nom = prox.type === 'tp' ? 'TP' : cap(prox.type).toLowerCase();
        const fe = parse(prox.date).toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' });
        h.replaceChildren(el('div', 'lbl', 'Próxima fecha'), dm(n === 0 ? '0' : String(n)),
            el('p', null, n === 0 ? cap(prox.type) + ': ' + prox.materia : (n === 1 ? 'día' : 'días') + ' para el ' + nom + ' de ' + prox.materia),
            el('small', null, (rangoTexto(prox) || fe) + (prox.hora ? ', ' + prox.hora + ' h' : '')));
    } else h.replaceChildren(el('div', 'lbl', 'Próxima fecha'), dm('0'), el('p', null, 'Sin fechas pendientes'), el('small', null, 'Anotá tu próximo parcial, final o TP.'));

    const cs = events.map(e => parseFloat(String(e.calif || '').replace(',', '.'))).filter(n => !isNaN(n));
    const prom = cs.length ? (cs.reduce((a, b) => a + b, 0) / cs.length).toLocaleString('es-AR', { maximumFractionDigits: 1 }) : '-';
    const st = (v, l) => { const d = el('div'); d.append(el('span', null, l), el('b', null, String(v))); return d };
    $('stats').replaceChildren(st(events.filter(pend).length, 'Pendientes'), st(events.filter(e => e.hecho).length, 'Hechos'), st(prom, 'Promedio'));

    const tot = events.length, hc = events.filter(e => e.hecho).length, k = tot ? Math.round(hc / tot * 36) : 0, db = $('dotbar');
    $('avn').textContent = hc + ' / ' + tot; $('avl').textContent = tot ? 'rendidos o entregados' : 'sin fechas todavía';
    db.replaceChildren(...Array.from({ length: 36 }, (_, i) => el('i', i < k ? (i === k - 1 ? 'on h' : 'on') : '')));
    $$('.fil').forEach(b => { const t = b.dataset.f; b.querySelector('.cn').textContent = events.filter(e => t === 'all' || e.type === t).length });
    const g = $('grid'); g.textContent = '';
    DIAS.forEach(d => g.appendChild(el('div', 'dow', d)));
    const off = (new Date(y, m, 1).getDay() + 6) % 7;
    const total = Math.ceil((off + new Date(y, m + 1, 0).getDate()) / 7) * 7, hoy = iso(new Date());
    cargarFeriados(new Date(y, m, 1 - off).getFullYear());
    cargarFeriados(new Date(y, m, total - off).getFullYear());
    for (let i = 0; i < total; i++) {
        const d = new Date(y, m, 1 - off + i), k = iso(d);
        const festivos = feriadosDelDia(k);
        const c = el('div', 'cell' + (d.getMonth() !== m ? ' out' : '') + (k === hoy ? ' today' : '') + (k === sel ? ' sel' : '') + (festivos.length ? ' holiday' : ''));
        const num = el('button', 'num', d.getDate());
        num.setAttribute('aria-label', d.getDate() + ' de ' + MESES[d.getMonth()] + (festivos.length ? ', feriado: ' + festivos.map(f => f.nombre).join(', ') : '') + '. Anotar fecha');
        num.onclick = () => tapDay(k);
        c.appendChild(num);
        festivos.forEach(f => { const label = el('div', 'holiday-label', f.nombre); label.title = 'Feriado: ' + f.nombre; c.appendChild(label) });
        const ev = all.filter(e => e.date <= k && fin(e) >= k).sort(ord);
        ev.forEach(e => {
            const b = el('button', 'chip ' + e.type + (e.hecho ? ' done' : ''), (e.hecho ? '✓ ' : '') + cap(e.type) + ': ' + e.materia);
            b.title = estadoFecha(e) + ' · ' + e.materia + (e.hora ? ', ' + e.hora + ' h' : '') + (textoNotas(e) ? ' - ' + textoNotas(e) : '');
            b.onclick = x => { x.stopPropagation(); openPreview(e) };
            c.appendChild(b);
        });
        if (ev.length) { const dots = el('div', 'dots'); ev.forEach(e => dots.appendChild(el('span', 'dot ' + e.type))); c.appendChild(dots) }
        c.onclick = x => { if (x.target === c) tapDay(k) };
        g.appendChild(c);
    }

    const dp = $('daypanel'), evs = all.filter(e => e.date <= sel && fin(e) >= sel).sort(ord);
    const dph = el('div', 'dph'), add = el('button', 'btn primary', 'Anotar acá');
    add.onclick = () => openModal(null, sel);
    dph.append(el('b', null, parse(sel).toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })), add);
    dp.replaceChildren(dph);
    const festivosSel = feriadosDelDia(sel);
    festivosSel.forEach(f => {
        const row = el('div', 'dprow holiday-row');
        row.append(el('span', 'holiday-tag', 'Feriado'), el('b', null, f.nombre));
        dp.appendChild(row);
    });
    if (!evs.length && !festivosSel.length) dp.appendChild(el('div', 'empty', 'Sin fechas este día.'));
    evs.forEach(e => {
        const b = el('button', 'dprow ' + e.type + (e.hecho ? ' done' : ''));
        b.append(el('span', 'tag ' + e.type, cap(e.type)), el('b', null, e.materia), el('small', null, [estadoFecha(e), e.hora && e.hora + ' h', textoNotas(e)].filter(Boolean).join(' · ')));
        b.onclick = () => openPreview(e); dp.appendChild(b);
    });

    const l = $('lista'); l.textContent = '';
    const rows = modo === 'mes' ? mes : all.filter(pend).sort(ord);
    if (!rows.length) { l.appendChild(el('div', 'empty', modo === 'mes' ? 'No hay fechas este mes. Tocá un día del calendario para anotar un parcial, un final o un TP.' : 'No tenés nada pendiente. Cuando anotes una fecha nueva, la vas a ver acá.')); }
    rows.forEach(e => {
        const n = diff(e.date), d = parse(e.date);
        const r = el('div', 'row ' + e.type + (e.hecho ? ' done' : '') + (!e.hecho && n >= 0 && n <= 3 ? ' urg' : ''));
        const ck = el('button', 'chk', e.hecho ? '✓' : '');
        ck.setAttribute('aria-pressed', String(!!e.hecho));
        ck.setAttribute('aria-label', 'Marcar ' + e.materia + ' como hecho');
        ck.onclick = () => { e.hecho = !e.hecho; save(); render() };
        const mn = el('button', 'main');
        const dd = el('div', 'd', String(d.getDate()));
        dd.appendChild(el('span', null, DIAS[(d.getDay() + 6) % 7] + (modo === 'mes' ? '' : ' ' + d.toLocaleDateString('es-AR', { month: 'short' }).replace('.', ''))));
        const mm = el('div', 'm'); mm.appendChild(el('b', null, e.materia));
        mm.appendChild(cuenta(e));
        const detalles = [rangoTexto(e), e.hora && e.hora + ' h', e.calif && 'Nota ' + e.calif, textoNotas(e)].filter(Boolean).join(' · ');
        if (detalles) mm.appendChild(el('span', 'row-details', detalles));
        mn.append(dd, mm, el('span', 'tag ' + e.type, cap(e.type)));
        mn.onclick = () => openPreview(e);
        r.append(ck, mn); l.appendChild(r);
    });
    $('mats').replaceChildren(...[...new Set(events.map(e => e.materia))].sort().map(v => { const o = el('option'); o.value = v; return o }));
}

function agregarNota(value = '') {
    const wrap = el('div', 'note-field'), area = el('textarea'), footer = el('div', 'note-footer');
    area.maxLength = 500; area.value = value; area.placeholder = 'Aula, temas, si es grupal…';
    area.setAttribute('aria-label', 'Nota');
    const count = el('span'), remove = el('button', 'note-remove', 'Quitar');
    remove.type = 'button'; remove.onclick = () => wrap.remove();
    area.oninput = () => { count.textContent = area.value.length + ' / 500' };
    area.oninput(); footer.append(count, remove); wrap.append(area, footer); $('notas').appendChild(wrap);
}
$('addnota').onclick = () => { agregarNota(); $('notas').lastElementChild.querySelector('textarea').focus() };

function openPreview(e) {
    editing = e; armed = false;
    const content = $('preview-content');
    const title = el('h3', null, e.materia); title.id = 'preview-title';
    const details = el('p', 'preview-details', (rangoTexto(e) || parse(e.date).toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })) + (e.hora ? ' · ' + e.hora + ' h' : ''));
    content.replaceChildren(el('span', 'tag ' + e.type, cap(e.type)), title, details,
        el('p', 'preview-status', e.hecho ? '✓ Hecho' + (e.calif ? ' · Nota ' + e.calif : '') : 'Pendiente · ' + estadoFecha(e)));
    const notes = notasDe(e);
    if (notes.length) {
        content.appendChild(el('div', 'lbl', 'Notas'));
        notes.forEach(n => content.appendChild(el('p', 'preview-note', n)));
    }
    $('preview-grade').hidden = true; $('preview-calif').value = e.calif || '';
    $('preview-delete').textContent = 'Eliminar';
    $('preview-done').textContent = e.type === 'recordatorio' ? (e.hecho ? 'Marcar pendiente' : 'Marcar hecho') : e.hecho ? 'Editar nota' : (e.type === 'tp' ? 'Ya entregué' : 'Ya rendí');
    showOverlay('preview'); $('preview-edit').focus();
}
$('preview-edit').onclick = () => { $('preview').classList.remove('open'); openModal(editing) };
$('preview-done').onclick = () => { if (editing.type === 'recordatorio') { editing.hecho = !editing.hecho; save(); render(); openPreview(editing); return } $('preview-grade').hidden = false; $('preview-calif').focus() };
$('preview-save-grade').onclick = () => { editing.hecho = true; editing.calif = $('preview-calif').value.trim(); save(); render(); openPreview(editing) };
$('preview-delete').onclick = () => {
    if (!armed) { armed = true; $('preview-delete').textContent = '¿Seguro? Tocá de nuevo'; return }
    events = events.filter(e => e !== editing); save(); close(); render();
};
$('preview-close').onclick = () => close();

function openModal(e, date) {
    editing = e; armed = false;
    $('mt').textContent = e ? 'Editar fecha' : 'Anotar fecha';
    $(e && e.type === 'final' ? 't2' : e && e.type === 'tp' ? 't3' : e && e.type === 'recordatorio' ? 't4' : 't1').checked = true;
    $('materia').value = e ? e.materia : '';
    $('fecha').value = e ? e.date : (date || iso(new Date()));
    $('fecha-fin').value = e && e.endDate || '';
    $('fecha-error').hidden = true;
    $('hora').value = e && e.hora || '';
    $('notas').replaceChildren();
    (e && notasDe(e).length ? notasDe(e) : ['']).forEach(agregarNota);
    $('hecho').checked = !!(e && e.hecho);
    $('calif').value = e && e.calif || '';
    actualizarTipo();
    $('del').hidden = !e; $('del').textContent = 'Eliminar';
    showOverlay('ov');
    setTimeout(() => $('materia').focus(), 0);
}
const close = () => {
    $$('.overlay').forEach(o => o.classList.remove('open'));
    if (document.body.classList.contains('modal-open')) {
        document.body.classList.remove('modal-open');
        document.body.style.top = '';
        window.scrollTo(0, scrollBeforeModal);
    }
};
function actualizarTipo() {
    const recordatorio = $('t4').checked;
    $('fin-wrap').hidden = !recordatorio;
    $('hora-wrap').hidden = recordatorio;
    $('materia-label').textContent = recordatorio ? 'Recordatorio' : 'Materia';
    $('materia').placeholder = recordatorio ? 'Ej: Inscripción al final' : 'Ej: Programación II';
    $('fecha-label').textContent = recordatorio ? 'Fecha de inicio' : 'Fecha';
    $('hecho-label').textContent = recordatorio ? 'Ya lo hice' : 'Ya lo rendí o entregué';
    $('califw').hidden = recordatorio || !$('hecho').checked;
    $('fecha-error').hidden = true;
}
$$('input[name=tipo]').forEach(r => r.onchange = actualizarTipo);
$('hecho').onchange = actualizarTipo;
$('save').onclick = () => {
    const materia = $('materia').value.trim(), fecha = $('fecha').value;
    if (!materia) { $('materia').focus(); return }
    if (!fecha) { $('fecha').focus(); return }
    const recordatorio = $('t4').checked, fechaFin = $('fecha-fin').value;
    if (recordatorio && (!fechaFin || fechaFin < fecha)) { $('fecha-error').hidden = false; $('fecha-fin').focus(); return }
    const data = { type: document.querySelector('input[name=tipo]:checked').value, materia, date: fecha, hora: $('hora').value, notas: [...$('notas').querySelectorAll('textarea')].map(n => n.value.trim()).filter(Boolean), nota: '', hecho: $('hecho').checked, calif: $('hecho').checked ? $('calif').value.trim() : '' };
    data.endDate = recordatorio ? fechaFin : ''; if (recordatorio) { data.calif = ''; data.hora = '' }
    if (editing) Object.assign(editing, data);
    else events.push(Object.assign({ id: Date.now() + '' + Math.floor(Math.random() * 1e4) }, data));
    save(); close();
    const d = parse(fecha); view = new Date(d.getFullYear(), d.getMonth(), 1); sel = fecha; render();
};
$('del').onclick = () => {
    if (!armed) { armed = true; $('del').textContent = '¿Seguro? Tocá de nuevo'; return }
    events = events.filter(x => x !== editing); save(); close(); render();
};
$('cancel').onclick = close; $('bkclose').onclick = close;
$$('.overlay').forEach(o => o.onclick = e => { if (e.target === o) close() });

$('resp').onclick = () => { $('bk').value = JSON.stringify(events); $('bkmsg').textContent = ''; showOverlay('ov2') };
$('bkcopy').onclick = async () => {
    $('bk').select();
    try { await navigator.clipboard.writeText($('bk').value); $('bkmsg').textContent = 'Copiado.' }
    catch (e) { $('bkmsg').textContent = 'Con el texto seleccionado, copialo a mano.' }
};
$('bkimp').onclick = () => {
    try {
        const a = JSON.parse($('bk').value); if (!Array.isArray(a)) throw 0;
        const ids = new Set(events.map(e => e.id)); let n = 0;
        a.forEach(e => {
            if (e && /^\d{4}-\d{2}-\d{2}$/.test(e.date) && TIPOS[e.type] && e.materia && !ids.has(e.id)) {
                events.push({ id: e.id || Date.now() + 'i' + n, type: e.type, materia: String(e.materia).slice(0, 60), date: e.date, endDate: typeof e.endDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(e.endDate) && e.endDate >= e.date ? e.endDate : '', hora: e.hora || '', notas: notasDe(e).map(n => String(n).slice(0, 500)), nota: '', hecho: !!e.hecho, calif: String(e.calif || '').slice(0, 5) }); n++;
            }
        });
        save(); render(); $('bkmsg').textContent = n + (n === 1 ? ' fecha importada.' : ' fechas importadas.');
    } catch (x) { $('bkmsg').textContent = 'Ese texto no es un respaldo válido.' }
};

$$('.fil').forEach(b => b.onclick = () => { filter = b.dataset.f; $$('.fil').forEach(x => x.setAttribute('aria-pressed', String(x === b))); render() });
$$('.tab').forEach(b => b.onclick = () => { modo = b.dataset.m; $$('.tab').forEach(x => x.setAttribute('aria-pressed', String(x === b))); render() });
const goto = (y, m) => { view = new Date(y, m, 1); const t = new Date(); sel = iso(t.getFullYear() === view.getFullYear() && t.getMonth() === view.getMonth() ? t : view); render() };
$('prev').onclick = () => goto(view.getFullYear(), view.getMonth() - 1);
$('next').onclick = () => goto(view.getFullYear(), view.getMonth() + 1);
$('hoy').onclick = () => { const t = new Date(); goto(t.getFullYear(), t.getMonth()) };
$('nuevo').onclick = () => openModal(null, iso(new Date()));

document.addEventListener('keydown', e => {
    if (e.key === 'Escape') { close(); return }
    const open = document.querySelector('.overlay.open');
    if (open) {
        if (e.key === 'Enter' && open.id === 'ov' && e.target.tagName === 'INPUT' && e.target.type === 'text') $('save').click();
        return;
    }
    if (/INPUT|TEXTAREA/.test(e.target.tagName) || e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === 'ArrowLeft') $('prev').click();
    else if (e.key === 'ArrowRight') $('next').click();
    else if (e.key === 't' || e.key === 'T') $('hoy').click();
    else if (e.key === 'n' || e.key === 'N') { e.preventDefault(); $('nuevo').click() }
});

const root = document.documentElement;
try { const t = localStorage.getItem(TK); if (t) root.setAttribute('data-theme', t) } catch (e) { }
$('tema').onclick = () => {
    const cur = root.getAttribute('data-theme') || (matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
    const nx = cur === 'dark' ? 'light' : 'dark'; root.setAttribute('data-theme', nx);
    try { localStorage.setItem(TK, nx) } catch (e) { }
};
render();

/* Mejoras para Calendario: Agenda, Materias, Estadísticas, avisos, exportar .ics
Va DESPUÉS del <script> principal. Usa events, render, openModal, etc. del script original. */
(() => {
    const wrap = document.querySelector('.wrap');
    const P = el('section'); P.id = 'pantalla'; wrap.appendChild(P);
    const A = el('div'); A.id = 'aviso'; A.hidden = true; wrap.insertBefore(A, wrap.querySelector('.cards'));
    const vs = el('div', 'vs'); vs.setAttribute('role', 'group');
    const V = [['cal', 'Calendario'], ['agenda', 'Agenda'], ['mats', 'Materias'], ['stats', 'Estadísticas']];
    let cur = 'cal', q = '';
    V.forEach(([k, t]) => { const b = el('button', 'vt', t); b.dataset.v = k; b.onclick = () => go(k); vs.appendChild(b) });
    wrap.insertBefore(vs, wrap.querySelector('.top'));

    const num = e => parseFloat(String(e.calif || '').replace(',', '.'));
    const fmt = n => n.toFixed(1).replace('.', ',');
    const item = e => {
        const b = el('button', 'it ' + e.type + (e.hecho ? ' done' : ''));
        b.append(el('span', 'tag ' + e.type, cap(e.type)), el('b', null, e.materia),
            el('small', null, [e.hora && e.hora + ' h', !isNaN(num(e)) && 'Nota ' + e.calif, textoNotas(e)].filter(Boolean).join(' · ')), cuenta(e));
        b.onclick = () => openPreview(e); return b;
    };

    function pAgenda() {
        const bar = el('div', 'ph'), s = el('input'); s.type = 'text'; s.placeholder = 'Buscar materia o nota…'; s.value = q;
        const x = el('button', 'btn', 'Exportar .ics'); x.onclick = ics; x.title = 'Para Google Calendar, Apple Calendar, Outlook';
        const L = el('div', 'list');
        const f = () => {
            L.replaceChildren(); const t = q.toLowerCase();
            const ev = events.filter(e => !t || (e.materia + ' ' + textoNotas(e)).toLowerCase().includes(t)).sort(ord);
            const grp = (titulo, arr) => { if (!arr.length) return; L.appendChild(el('div', 'gt', titulo)); arr.forEach(e => L.appendChild(item(e))) };
            grp('Pasaron y no marcaste como hechas', ev.filter(e => !e.hecho && diff(fin(e)) < 0));
            grp('Próximos 7 días', ev.filter(e => pend(e) && diff(fechaPendiente(e)) <= 7));
            grp('Más adelante', ev.filter(e => !e.hecho && diff(e.date) > 7));
            grp('Hechas (últimas 10)', ev.filter(e => e.hecho).reverse().slice(0, 10));
            if (!L.children.length) L.appendChild(el('div', 'empty', 'Nada para mostrar.'));
        };
        s.oninput = () => { q = s.value; f() }; f(); bar.append(s, x); P.append(bar, L);
    }

    function pMats() {
        const g = {}; events.forEach(e => (g[e.materia] = g[e.materia] || []).push(e));
        const names = Object.keys(g).sort();
        if (!names.length) { P.appendChild(el('div', 'empty', 'Todavía no anotaste materias.')); return }
        const grid = el('div', 'mg');
        names.forEach(n => {
            const a = g[n], d = a.filter(e => e.hecho), cs = a.map(num).filter(v => !isNaN(v));
            const nx = a.filter(pend).sort(ord)[0], c = el('button', 'card mc');
            const bar = el('div', 'pb'), i = el('i'); i.style.width = Math.round(d.length / a.length * 100) + '%'; bar.appendChild(i);
            c.append(el('b', null, n), el('small', null, nx ? 'Próxima: ' + cuando(diff(nx.date)).toLowerCase() + ' · ' + cap(nx.type) : 'Sin pendientes'),
                bar, el('small', null, d.length + '/' + a.length + ' hechos · Promedio ' + (cs.length ? fmt(cs.reduce((x, y) => x + y, 0) / cs.length) : '-')));
            c.onclick = () => { if (nx) { const t = parse(nx.date); view = new Date(t.getFullYear(), t.getMonth(), 1); sel = nx.date } go('cal') };
            grid.appendChild(c);
        });
        P.appendChild(grid);
    }

    function pStats() {
        const cs = events.filter(e => !isNaN(num(e))), ap = cs.filter(e => num(e) >= 4).length;
        const tot = events.length, hc = events.filter(e => e.hecho).length;
        const kp = el('div', 'kp');
        [[cs.length ? fmt(cs.reduce((a, e) => a + num(e), 0) / cs.length) : '-', 'Promedio'], [ap + '/' + cs.length, 'Aprobadas (nota ≥ 4)'],
        [tot ? Math.round(hc / tot * 100) + '%' : '-', 'Cumplido'], [events.filter(e => pend(e) && diff(e.date) <= 30).length, 'Próximos 30 días']]
            .forEach(([v, l]) => { const c = el('div', 'card'); c.append(el('span', 'lbl', l), el('b', null, String(v))); kp.appendChild(c) });
        const y = new Date().getFullYear(), M = Array.from({ length: 12 }, () => [0, 0]);
        events.forEach(e => { const d = parse(e.date); if (d.getFullYear() === y) M[d.getMonth()][e.hecho ? 0 : 1]++ });
        const mx = Math.max(1, ...M.map(a => a[0] + a[1])), ch = el('div', 'card ch'), bars = el('div', 'bars');
        M.forEach((a, i) => {
            const c = el('div', 'bc'), bs = el('div', 'bs');
            [[a[1], 'var(--parcial)'], [a[0], 'var(--ink)']].forEach(([n, col]) => { const b = el('i'); b.style.height = n / mx * 100 + '%'; b.style.background = col; bs.appendChild(b) });
            c.append(bs, el('span', null, MESES[i].slice(0, 3))); bars.appendChild(c);
        });
        const leg = el('div', 'leg'); leg.append(el('span', null, '■ Pendientes'), el('span', null, '■ Hechas'));
        ch.append(el('div', 'lbl', 'Fechas por mes · ' + y), bars, leg);
        const nt = el('div', 'card ch'); nt.appendChild(el('div', 'lbl', 'Notas obtenidas'));
        if (!cs.length) nt.appendChild(el('p', 'sub', 'Marcá una fecha como hecha y cargá la nota para verla acá.'));
        cs.sort((a, b) => num(b) - num(a)).slice(0, 10).forEach(e => {
            const r = el('div', 'nr'), bar = el('div', 'pb'), i = el('i');
            i.style.width = Math.min(100, num(e) * 10) + '%'; i.style.background = num(e) < 4 ? 'var(--final)' : 'var(--parcial)'; bar.appendChild(i);
            r.append(el('span', null, cap(e.type) + ' · ' + e.materia), bar, el('b', null, e.calif)); nt.appendChild(r);
        });
        P.append(kp, ch, nt);
    }

    function ics() {
        const z = pad, s = d => d.getFullYear() + z(d.getMonth() + 1) + z(d.getDate()), cl = t => String(t).replace(/[,;\n]/g, ' ');
        const L = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Calendario//ES', 'CALSCALE:GREGORIAN'];
        events.forEach(e => {
            const d = parse(e.date); L.push('BEGIN:VEVENT', 'UID:' + e.id + '@calendario', 'DTSTAMP:' + s(new Date()) + 'T000000Z');
            if (e.hora && !e.endDate) { const [h, m] = e.hora.split(':').map(Number), f = hh => s(d) + 'T' + z(hh) + z(m) + '00'; L.push('DTSTART:' + f(h), 'DTEND:' + f(Math.min(h + 2, 23))) }
            else { const n = parse(fin(e)); n.setDate(n.getDate() + 1); L.push('DTSTART;VALUE=DATE:' + s(d), 'DTEND;VALUE=DATE:' + s(n)) }
            L.push('SUMMARY:' + cap(e.type) + ': ' + cl(e.materia)); if (textoNotas(e)) L.push('DESCRIPTION:' + cl(textoNotas(e)));
            L.push('BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:Es mañana', 'TRIGGER:-P1D', 'END:VALARM', 'END:VEVENT');
        });
        L.push('END:VCALENDAR');
        const a = el('a'); a.href = URL.createObjectURL(new Blob([L.join('\r\n')], { type: 'text/calendar' })); a.download = 'calendario.ics'; a.click();
    }

    function aviso() {
        const n = events.filter(e => pend(e) && diff(fechaPendiente(e)) <= 3).sort(ord);
        A.replaceChildren(); A.hidden = !n.length; if (!n.length) return;
        A.appendChild(el('span', null, '⏰ ' + n.slice(0, 3).map(e => cap(e.type) + ' ' + e.materia + ' (' + estadoFecha(e).toLowerCase() + ')').join(' · ') + (n.length > 3 ? ' y ' + (n.length - 3) + ' más' : '')));
        if (window.Notification && Notification.permission === 'default') {
            const b = el('button', 'btn', 'Activar avisos'); b.onclick = () => Notification.requestPermission().then(() => { aviso(); notif() }); A.appendChild(b);
        }
    }
    function notif() {
        try {
            if (!window.Notification || Notification.permission !== 'granted') return;
            const h = iso(new Date()); if (localStorage.getItem('calendario-notif') === h) return;
            const n = events.filter(e => pend(e) && diff(fechaPendiente(e)) <= 1); if (!n.length) return;
            localStorage.setItem('calendario-notif', h);
            new Notification('Calendario', { body: n.map(e => cap(e.type) + ' ' + e.materia + ' · ' + estadoFecha(e)).join('\n') });
        } catch (e) { }
    }

    const MAP = { agenda: pAgenda, mats: pMats, stats: pStats };
    const pant = () => { P.replaceChildren(); MAP[cur]() };
    function go(k) {
        cur = k; wrap.classList.toggle('alt', k !== 'cal');
        vs.querySelectorAll('.vt').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.v === k)));
        if (k === 'cal') render(); else pant();
        scrollTo(0, 0);
    }
    const r0 = render;
    render = function () { r0(); aviso(); if (cur !== 'cal') pant() };

    document.addEventListener('keydown', e => {
        if (document.querySelector('.overlay.open') || /INPUT|TEXTAREA/.test(e.target.tagName) || e.metaKey || e.ctrlKey || e.altKey) return;
        const i = '1234'.indexOf(e.key); if (i > -1) go(V[i][0]);
    });

    go('cal'); notif();
})();
