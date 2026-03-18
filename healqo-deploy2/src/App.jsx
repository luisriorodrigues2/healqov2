import React, { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "./supabase.js";
import {
  Calendar,
  CalendarDays,
  Tent,
  BarChart3,
  LineChart,
  Stethoscope,
  ChevronLeft,
  ChevronRight,
  X,
  Plus,
  Pencil,
  Sun,
  Sunset,
  Moon,
  Trash2,
  Save,
  Info,
  Activity,
  Users
} from "lucide-react";

// --- Constants & Config ---
const CATEGORIES = [
  { id: "bloco", label: "Bloco Operatório", short: "BO", color: "#E74C3C", bg: "#FDEDEC" },
  { id: "urgencia", label: "Urgência", short: "URG", color: "#E67E22", bg: "#FDF2E9" },
  { id: "uml", label: "UML", short: "UML", color: "#8E44AD", bg: "#F4ECF7" },
  { id: "consulta", label: "Consulta", short: "CON", color: "#2E86C1", bg: "#EBF5FB" },
  { id: "consulta_urg", label: "Consulta + Urgência", short: "C+U", color: "#2980B9", bg: "#D6EAF8" },
  { id: "extra", label: "Consulta Extra", short: "C.EX", color: "#1ABC9C", bg: "#E8F8F5" },
  { id: "sigic", label: "SIGIC", short: "SIG", color: "#C0392B", bg: "#F9EBEA" },
  { id: "relatorios", label: "Relatórios", short: "REL", color: "#6C3483", bg: "#F5EEF8" },
  { id: "livre", label: "Horário Livre", short: "LIV", color: "#7F8C8D", bg: "#F2F3F4" },
];

const URGENCY_IDS = ["urgencia", "consulta_urg", "uml"];
const WORK_EXCLUDED = ["livre"];
const DAYS = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"];
const DS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
const PERIODS = ["Manhã", "Tarde", "Noite"];

const PICON_MAP = { "Manhã": Sun, "Tarde": Sunset, "Noite": Moon };
const PICON_COLOR = { "Manhã": "#f59e0b", "Tarde": "#f97316", "Noite": "#6366f1" };
const PHOURS = { "Manhã": 4, "Tarde": 4, "Noite": 12 };
const MONTHS = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const MONTHS_SHORT = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

const DEFAULT_TEAM = [
  { id: "s1", name: "Especialista 1", role: "specialist" },
  { id: "s2", name: "Especialista 2", role: "specialist" },
  { id: "s3", name: "Especialista 3", role: "specialist" },
  { id: "s4", name: "Especialista 4", role: "specialist" },
  { id: "r1", name: "Interno 1", role: "resident" },
  { id: "r2", name: "Interno 2", role: "resident" },
  { id: "r3", name: "Interno 3", role: "resident" },
];

const PATIENT_STATUS = [
  { id: "estavel", label: "Estável", color: "#27ae60" },
  { id: "observacao", label: "Em Observação", color: "#f39c12" },
  { id: "critico", label: "Crítico", color: "#e74c3c" },
  { id: "alta_prevista", label: "Alta Prevista", color: "#2e86c1" },
];

const ABSENCE_TYPES = [
  { id: "ferias", label: "Férias", color: "#f39c12", icon: "🏖️" },
  { id: "congresso", label: "Congresso", color: "#8E44AD", icon: "🎓" },
  { id: "formacao", label: "Formação", color: "#2E86C1", icon: "📚" },
  { id: "licenca", label: "Licença", color: "#7F8C8D", icon: "📋" },
  { id: "outro", label: "Outro", color: "#95a5a6", icon: "📌" },
];

// --- Utilities ---
function getCat(id) { return CATEGORIES.find(c => c.id === id) || null; }
function getAbsType(id) { return ABSENCE_TYPES.find(a => a.id === id) || null; }
function hexToRgba(hex, alpha) {
  const h = hex.replace("#", "");
  return `rgba(${parseInt(h.substring(0, 2), 16)},${parseInt(h.substring(2, 4), 16)},${parseInt(h.substring(4, 6), 16)},${alpha})`;
}

function getMonday(d) {
  const dt = new Date(d); const day = dt.getDay();
  dt.setDate(dt.getDate() - day + (day === 0 ? -6 : 1));
  dt.setHours(0, 0, 0, 0); return dt;
}
function getWeekDates(mon) { return Array.from({ length: 7 }, (_, i) => { const d = new Date(mon); d.setDate(mon.getDate() + i); return d; }); }
function getWN(d) { const dt = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())); const dn = dt.getUTCDay() || 7; dt.setUTCDate(dt.getUTCDate() + 4 - dn); const ys = new Date(Date.UTC(dt.getUTCFullYear(), 0, 1)); return Math.ceil((((dt - ys) / 864e5) + 1) / 7); }
function makeWk(mon) { return `${mon.getFullYear()}-W${String(getWN(mon)).padStart(2, "0")}`; }
function fd(d) { return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`; }
function isoD(d) { try { return d.toISOString().slice(0, 10); } catch { return ""; } }
function sameDay(a, b) { return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate(); }

// --- Portuguese Holidays ---
function getEaster(year) {
  const a = year % 19, b = Math.floor(year / 100), c = year % 100;
  const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}
function getPortugueseHolidays(year) {
  const easter = getEaster(year);
  const ad = (d, n) => { const r = new Date(d); r.setDate(r.getDate() + n); return r; };
  return [
    { date: new Date(year, 0, 1), name: "Ano Novo" }, { date: ad(easter, -47), name: "Carnaval" },
    { date: ad(easter, -2), name: "Sexta-feira Santa" }, { date: easter, name: "Páscoa" },
    { date: new Date(year, 3, 25), name: "Dia da Liberdade" }, { date: new Date(year, 4, 1), name: "Dia do Trabalhador" },
    { date: ad(easter, 60), name: "Corpo de Deus" }, { date: new Date(year, 5, 10), name: "Dia de Portugal" },
    { date: new Date(year, 7, 15), name: "Assunção de N. Senhora" }, { date: new Date(year, 9, 5), name: "Implantação da República" },
    { date: new Date(year, 10, 1), name: "Todos os Santos" }, { date: new Date(year, 11, 1), name: "Restauração da Independência" },
    { date: new Date(year, 11, 8), name: "Imaculada Conceição" }, { date: new Date(year, 11, 25), name: "Natal" },
  ];
}
function getHolidayName(date) { const hs = getPortugueseHolidays(date.getFullYear()); const h = hs.find(h => sameDay(h.date, date)); return h ? h.name : null; }
function isHoliday(date) { return !!getHolidayName(date); }
function isAbsent(absences, memberId, date) {
  if (!absences || !Array.isArray(absences) || !absences.length) return null;
  const ds = isoD(date); if (!ds) return null;
  return absences.find(a => a.memberId === memberId && ds >= a.start && ds <= a.end) || null;
}

// --- Storage (Supabase cloud + localStorage fallback) ---
const STORAGE_KEY = "healqo-v6";

async function loadAll() {
  try {
    const { data, error } = await supabase.from("app_data").select("data").eq("id", 1).single();
    if (!error && data) return data.data;
  } catch (e) {
    console.warn("Supabase load failed, trying localStorage...", e);
  }
  try {
    const r = localStorage.getItem(STORAGE_KEY);
    return r ? JSON.parse(r) : null;
  } catch { return null; }
}

async function saveAll(payload) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    await supabase.from("app_data").upsert({ id: 1, data: payload, updated_at: new Date().toISOString() });
  } catch (e) {
    console.error("Save error:", e);
  }
}

// --- Period Icon Component ---
function PeriodIcon({ period }) {
  const Icon = PICON_MAP[period];
  return Icon ? <Icon size={12} color={PICON_COLOR[period]} /> : null;
}

// --- UI Components ---
function CatPicker({ onSelect, current }) {
  return (
    <div className="absolute top-full left-1/2 z-50 bg-white rounded-lg shadow-xl p-2 border border-slate-200 overflow-y-auto mt-1" style={{ transform: "translateX(-50%)", minWidth: 200, maxHeight: 320 }}>
      {CATEGORIES.map(cat => (
        <button key={cat.id} onClick={(e) => { e.stopPropagation(); onSelect(cat.id); }}
          className="flex items-center gap-2 w-full px-3 py-2 border-none rounded-md cursor-pointer text-xs font-medium text-slate-700"
          style={{ backgroundColor: current === cat.id ? cat.bg : "transparent" }}
          onMouseEnter={e => { e.currentTarget.style.backgroundColor = cat.bg; }}
          onMouseLeave={e => { e.currentTarget.style.backgroundColor = current === cat.id ? cat.bg : "transparent"; }}>
          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: cat.color, flexShrink: 0 }} />
          {cat.label}
        </button>
      ))}
      <button onClick={(e) => { e.stopPropagation(); onSelect(null); }}
        className="flex items-center gap-2 w-full px-3 py-2 border-none rounded-md bg-transparent cursor-pointer text-xs font-medium text-slate-400 mt-1" style={{ borderTop: "1px solid #f1f5f9" }}>
        <X size={14} /> Limpar
      </button>
    </div>
  );
}

function BlockedCell({ absType, label }) {
  const at = getAbsType(absType); const c = at?.color || "#ccc";
  return (
    <div title={label || "Ausente"} className="w-full rounded-md flex items-center justify-center text-xs font-bold cursor-default overflow-hidden"
      style={{ height: 32, color: c, border: `1.5px solid ${hexToRgba(c, 0.25)}`, background: `repeating-linear-gradient(135deg,${hexToRgba(c, 0.12)},${hexToRgba(c, 0.12)} 4px,${hexToRgba(c, 0.04)} 4px,${hexToRgba(c, 0.04)} 8px)` }}>
      <div className="bg-white px-1 rounded text-xs" style={{ opacity: 0.9, fontSize: 10 }}>{at?.icon || "—"}</div>
    </div>
  );
}

function HolidayCell({ name }) {
  return (
    <div title={name} className="w-full rounded-md flex items-center justify-center text-xs font-bold text-red-500 cursor-default"
      style={{ height: 32, border: "1.5px solid rgba(231,76,60,0.2)", background: "repeating-linear-gradient(135deg,rgba(231,76,60,0.08),rgba(231,76,60,0.08) 4px,rgba(231,76,60,0.02) 4px,rgba(231,76,60,0.02) 8px)" }}>
      <div className="bg-white px-1 rounded" style={{ opacity: 0.9, fontSize: 10 }}>🇵🇹</div>
    </div>
  );
}

function Cell({ value, onChange, isNight, isWeekend }) {
  const [open, setOpen] = useState(false); const cat = getCat(value);
  return (
    <div className="relative w-full" style={{ padding: 1 }}>
      <button onClick={() => setOpen(!open)} className="w-full rounded-md flex items-center justify-center font-bold font-mono tracking-wider cursor-pointer"
        style={{
          height: 32, fontSize: 10, transition: "all 0.15s",
          border: cat ? `2px solid ${hexToRgba(cat.color, 0.3)}` : `1.5px dashed ${isNight ? "#475569" : "#cbd5e1"}`,
          background: cat ? cat.bg : (isNight ? "#1e293b" : isWeekend ? "#f8fafc" : "#fff"),
          color: cat ? cat.color : (isNight ? "#64748b" : "#cbd5e1"),
        }}>
        {cat ? cat.short : "+"}
      </button>
      {open && (<>
        <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
        <CatPicker current={value} onSelect={id => { onChange(id); setOpen(false); }} />
      </>)}
    </div>
  );
}

function NameEd({ member, onRename }) {
  const [editing, setEditing] = useState(false); const [val, setVal] = useState(member.name);
  useEffect(() => { setVal(member.name); }, [member.name]);
  if (editing) return (
    <input autoFocus value={val} onChange={e => setVal(e.target.value)}
      onBlur={() => { onRename(val || member.name); setEditing(false); }}
      onKeyDown={e => { if (e.key === "Enter") { onRename(val || member.name); setEditing(false); } }}
      className="w-full border-2 border-blue-400 rounded px-1.5 py-0.5 text-xs font-bold text-slate-800 bg-blue-50 outline-none" />
  );
  return (
    <div onClick={() => setEditing(true)} className="cursor-pointer flex items-center gap-1.5 group" title="Editar nome">
      <span className="text-xs font-bold text-slate-700 truncate" style={{ maxWidth: 100 }}>{member.name}</span>
      <Pencil size={10} className="text-slate-300 opacity-0 group-hover:opacity-100" style={{ transition: "opacity 0.2s" }} />
    </div>
  );
}

function buildSlots() { const s = []; for (let di = 0; di < DAYS.length; di++) for (let pi = 0; pi < PERIODS.length; pi++) s.push({ day: DAYS[di], dayIdx: di, period: PERIODS[pi] }); return s; }
const SLOTS = buildSlots();

// --- Stats Logic ---
function calcWeekStats(schedule, template, team, wkk, absences, weekDates, sigics) {
  const mh = {}, mUrg = {}, mLivre = {}, ct = {};
  CATEGORIES.forEach(c => { ct[c.id] = 0; });
  team.forEach(m => {
    let work = 0, urg = 0, livre = 0;
    DAYS.forEach((d, di) => { PERIODS.forEach(p => {
      const date = weekDates[di]; const dateStr = isoD(date);
      if (isAbsent(absences, m.id, date) || isHoliday(date)) return;
      const sk = `${wkk}|${m.id}|${d}|${p}`; const tk = `TPL|${m.id}|${d}|${p}`;
      const hasSigic = Array.isArray(sigics) && sigics.some(s => { const docs = s.doctors || (s.memberId ? [s.memberId] : []); return docs.includes(m.id) && s.date === dateStr && s.period === p; });
      const catId = schedule[sk] || (hasSigic ? "sigic" : null) || template[tk] || null;
      if (!catId) return;
      const h = PHOURS[p]; ct[catId] += h;
      if (WORK_EXCLUDED.includes(catId)) { livre += h; } else { work += h; }
      if (URGENCY_IDS.includes(catId)) { urg += h; }
    }); });
    mh[m.id] = work; mUrg[m.id] = urg; mLivre[m.id] = livre;
  });
  const totWork = Object.values(ct).reduce((a, b) => a + b, 0) - (ct["livre"] || 0);
  return { mh, mUrg, mLivre, ct, totWork, totLivre: ct["livre"] || 0 };
}

// --- Year Calendar Modal ---
function YearCalendar({ currentMonday, onSelect, onClose }) {
  const [year, setYear] = useState(currentMonday.getFullYear());
  const curWk = makeWk(currentMonday); const todayStr = new Date().toDateString();
  const holidays = useMemo(() => getPortugueseHolidays(year), [year]);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(15,23,42,0.5)", backdropFilter: "blur(4px)" }}>
      <div className="bg-white rounded-2xl shadow-2xl p-6 w-full overflow-y-auto" style={{ maxWidth: 820, maxHeight: "90vh" }}>
        <div className="flex justify-between items-center mb-6">
          <button onClick={() => setYear(y => y - 1)} className="p-2 bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-700"><ChevronLeft size={20} /></button>
          <h2 className="text-2xl font-black text-slate-800">{year}</h2>
          <button onClick={() => setYear(y => y + 1)} className="p-2 bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-700"><ChevronRight size={20} /></button>
        </div>
        <div className="flex gap-3 mb-6 justify-center flex-wrap">
          <button onClick={() => setYear(new Date().getFullYear())} className="px-4 py-2 border border-teal-500 bg-teal-50 text-teal-600 rounded-lg text-xs font-bold">{new Date().getFullYear()}</button>
          <button onClick={() => { onSelect(getMonday(new Date())); onClose(); }} className="px-4 py-2 border border-blue-500 bg-blue-50 text-blue-600 rounded-lg text-xs font-bold">Semana Atual</button>
        </div>
        <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))" }}>
          {Array.from({ length: 12 }, (_, mo) => {
            const so = (new Date(year, mo, 1).getDay() + 6) % 7; const dim = new Date(year, mo + 1, 0).getDate();
            const cells = []; for (let i = 0; i < so; i++) cells.push(null); for (let d = 1; d <= dim; d++) cells.push(new Date(year, mo, d));
            return (
              <div key={mo} className="bg-slate-50 rounded-xl p-3 border border-slate-200">
                <div className="text-center text-xs font-bold text-slate-800 mb-2 uppercase tracking-wider">{MONTHS_SHORT[mo]}</div>
                <div className="grid grid-cols-7 gap-1">
                  {["S", "T", "Q", "Q", "S", "S", "D"].map((l, i) => (<div key={i} className="text-center font-bold py-1" style={{ fontSize: 8, color: i >= 5 ? "#8b5cf6" : "#94a3b8" }}>{l}</div>))}
                  {cells.map((date, i) => {
                    if (!date) return <div key={`e${i}`} />;
                    const mn = getMonday(date); const w = makeWk(mn); const isCur = w === curWk; const isToday = date.toDateString() === todayStr;
                    const hol = holidays.find(h => sameDay(h.date, date)); const isWk = date.getDay() === 0 || date.getDay() === 6;
                    return (
                      <button key={i} onClick={() => { onSelect(getMonday(date)); onClose(); }} title={hol ? hol.name : ""}
                        className="border-none rounded-md py-1 cursor-pointer" style={{
                          fontSize: 9, fontWeight: isToday || hol || isCur ? 700 : 400,
                          background: isCur ? "#1e293b" : isToday ? "#14b8a6" : "transparent",
                          color: isCur || isToday ? "#fff" : hol ? "#ef4444" : isWk ? "#7c3aed" : "#334155",
                          textDecoration: hol && !isCur && !isToday ? "underline" : "none",
                        }}
                        onMouseEnter={e => { if (!isCur && !isToday) e.currentTarget.style.background = "#e2e8f0"; }}
                        onMouseLeave={e => { if (!isCur && !isToday) e.currentTarget.style.background = "transparent"; }}>
                        {date.getDate()}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
        <div className="mt-6 pt-4" style={{ borderTop: "1px solid #e2e8f0" }}>
          <div className="text-xs font-bold text-slate-500 mb-3 uppercase tracking-wider">Feriados {year}</div>
          <div className="flex flex-wrap gap-2">{holidays.map((h, i) => (<span key={i} className="text-red-600 bg-red-50 border border-red-100 px-2 py-1 rounded-md font-semibold" style={{ fontSize: 10 }}>{h.date.getDate()} {MONTHS_SHORT[h.date.getMonth()]} — {h.name}</span>))}</div>
        </div>
        <div className="flex justify-end mt-6"><button onClick={onClose} className="px-6 py-2.5 rounded-lg bg-slate-800 text-white font-bold text-sm">Fechar</button></div>
      </div>
    </div>
  );
}

// --- Tab: Template ---
function TemplateTab({ template, setTemplate, team, rename }) {
  const update = (key, catId) => { setTemplate(prev => { const n = { ...prev }; if (catId === null) delete n[key]; else n[key] = catId; return n; }); };
  const clearTpl = () => { if (confirm("Limpar todo o horário base?")) setTemplate({}); };
  return (
    <div className="bg-white rounded-b-xl shadow-sm border border-slate-200 p-5 overflow-hidden" style={{ borderTopRightRadius: 12 }}>
      <div className="flex justify-between items-start mb-5 pb-4 flex-wrap gap-4" style={{ borderBottom: "1px solid #f1f5f9" }}>
        <div>
          <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2"><CalendarDays size={20} color="#0d9488" /> Horário Base Semanal</h3>
          <p className="text-xs text-slate-500 mt-1" style={{ maxWidth: 500 }}>Define o horário padrão que se repete automaticamente em todas as semanas.</p>
        </div>
        <button onClick={clearTpl} className="flex items-center gap-2 px-4 py-2 border border-red-200 rounded-lg bg-red-50 text-red-600 font-bold text-xs"><Trash2 size={14} /> Limpar Base</button>
      </div>
      <div className="flex flex-wrap gap-2 mb-6">
        {CATEGORIES.map(cat => (<div key={cat.id} className="flex items-center gap-1.5 px-2.5 py-1 rounded-md border" style={{ backgroundColor: cat.bg, borderColor: hexToRgba(cat.color, 0.2) }}><span className="font-bold font-mono" style={{ fontSize: 10, color: cat.color }}>{cat.short}</span><span className="text-slate-600 font-medium" style={{ fontSize: 11 }}>{cat.label}</span></div>))}
      </div>
      <div className="overflow-x-auto pb-4"><div style={{ minWidth: 1050 }}>
        <div className="grid gap-1 mb-1" style={{ gridTemplateColumns: "120px repeat(21, minmax(0,1fr))" }}><div />{DAYS.map((d, di) => (<div key={d} className="text-center text-xs font-bold uppercase tracking-wider pt-2" style={{ gridColumn: "span 3", color: di >= 5 ? "#7c3aed" : "#1e293b" }}>{DS[di]}</div>))}</div>
        <div className="grid gap-1 mb-3 pb-2" style={{ gridTemplateColumns: "120px repeat(21, minmax(0,1fr))", borderBottom: "1px solid #f1f5f9" }}><div />{SLOTS.map((s, i) => (<div key={i} className="flex justify-center"><PeriodIcon period={s.period} /></div>))}</div>
        {["specialist", "resident"].map(role => (<div key={role} className="mb-4">
          <div className="text-xs font-bold uppercase tracking-widest mb-2 flex items-center gap-2" style={{ fontSize: 10, color: role === "specialist" ? "#1abc9c" : "#2e86c1" }}>{role === "specialist" ? "Especialistas" : "Internos"}<div className="flex-1" style={{ height: 1, background: "#f1f5f9" }} /></div>
          {team.filter(m => m.role === role).map(member => (<div key={member.id} className="grid gap-1 mb-1 items-center" style={{ gridTemplateColumns: "120px repeat(21, minmax(0,1fr))" }}>
            <div className="pr-2 py-1"><NameEd member={member} onRename={name => rename(member.id, name)} /></div>
            {SLOTS.map((s, i) => { const key = `TPL|${member.id}|${s.day}|${s.period}`; return <Cell key={i} value={template[key] || null} onChange={catId => update(key, catId)} isNight={s.period === "Noite"} isWeekend={s.dayIdx >= 5} />; })}
          </div>))}
        </div>))}
      </div></div>
    </div>
  );
}

// --- Tab: SIGIC ---
function SigicTab({ sigics, setSigics, team }) {
  const [viewYear, setViewYear] = useState(new Date().getFullYear());
  const [viewMonth, setViewMonth] = useState(new Date().getMonth());
  const [selectedDate, setSelectedDate] = useState(null);
  const [form, setForm] = useState({ period: "Manhã", doctor1: "", doctor2: "", notes: "" });
  const calendarDays = useMemo(() => {
    const date = new Date(viewYear, viewMonth, 1); const days = [];
    let dow = date.getDay() - 1; if (dow === -1) dow = 6;
    for (let i = 0; i < dow; i++) { const pd = new Date(viewYear, viewMonth, 0 - (dow - 1 - i)); days.push({ date: pd, isCurrentMonth: false }); }
    while (date.getMonth() === viewMonth) { days.push({ date: new Date(date), isCurrentMonth: true }); date.setDate(date.getDate() + 1); }
    const rem = 7 - (days.length % 7); if (rem < 7) for (let i = 0; i < rem; i++) days.push({ date: new Date(viewYear, viewMonth + 1, i + 1), isCurrentMonth: false });
    return days;
  }, [viewYear, viewMonth]);
  const prevMo = () => { if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); } else setViewMonth(m => m - 1); };
  const nextMo = () => { if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); } else setViewMonth(m => m + 1); };
  const addSigic = () => {
    if (!form.doctor1) { alert("Selecione pelo menos o 1º cirurgião."); return; }
    if (form.doctor2 && form.doctor1 === form.doctor2) { alert("1º e 2º cirurgião não podem ser iguais."); return; }
    const docs = form.doctor2 ? [form.doctor1, form.doctor2] : [form.doctor1];
    setSigics(p => [...(Array.isArray(p) ? p : []), { id: `s${Date.now()}`, date: isoD(selectedDate), period: form.period, doctors: docs, notes: form.notes }]);
    setForm({ period: "Manhã", doctor1: "", doctor2: "", notes: "" });
  };
  const removeSigic = id => { if (confirm("Remover?")) setSigics(p => p.filter(x => x.id !== id)); };
  const getDocName = id => team.find(m => m.id === id)?.name || "?";
  const safeSigics = Array.isArray(sigics) ? sigics : [];

  return (
    <div className="bg-white rounded-b-xl shadow-sm border border-slate-200 p-6 relative" style={{ borderTopRightRadius: 12 }}>
      <div className="flex flex-wrap justify-between items-start gap-4 mb-6">
        <div><h3 className="text-lg font-bold text-slate-800 flex items-center gap-2"><Activity size={20} color="#ef4444" /> SIGIC - Calendário</h3><p className="text-xs text-slate-500 mt-1">Clique num dia para gerir as equipas cirúrgicas.</p></div>
        <div className="flex items-center gap-2 bg-slate-50 px-2 py-1.5 rounded-lg border border-slate-200">
          <button onClick={prevMo} className="p-1.5 hover:bg-white rounded-md text-slate-600"><ChevronLeft size={16} /></button>
          <span className="text-sm font-bold text-slate-800" style={{ minWidth: 130, textAlign: "center" }}>{MONTHS[viewMonth]} {viewYear}</span>
          <button onClick={nextMo} className="p-1.5 hover:bg-white rounded-md text-slate-600"><ChevronRight size={16} /></button>
        </div>
      </div>
      <div className="grid grid-cols-7 border border-slate-200 rounded-xl overflow-hidden" style={{ gap: 1, background: "#e2e8f0" }}>
        {DAYS.map(d => (<div key={d} className="bg-slate-50 py-2 text-center text-xs font-bold text-slate-500 uppercase tracking-wider">{DS[DAYS.indexOf(d)]}</div>))}
        {calendarDays.map((item, idx) => {
          const dateStr = isoD(item.date); const daySigics = safeSigics.filter(s => s.date === dateStr); const isToday = isoD(new Date()) === dateStr;
          return (
            <div key={idx} onClick={() => { setSelectedDate(item.date); setForm({ period: "Manhã", doctor1: "", doctor2: "", notes: "" }); }}
              className="bg-white p-2 cursor-pointer flex flex-col" style={{ minHeight: 100, opacity: item.isCurrentMonth ? 1 : 0.4, transition: "background 0.15s" }}
              onMouseEnter={e => { e.currentTarget.style.background = "#fef2f2"; }} onMouseLeave={e => { e.currentTarget.style.background = "#fff"; }}>
              <div className="flex justify-between items-start mb-1">
                <span className="text-sm font-bold flex items-center justify-center rounded-full" style={{ width: 28, height: 28, background: isToday ? "#ef4444" : "transparent", color: isToday ? "#fff" : "#334155" }}>{item.date.getDate()}</span>
                {daySigics.length > 0 && <span className="text-xs font-bold text-red-500 bg-red-50 px-1.5 rounded-full" style={{ fontSize: 10 }}>{daySigics.length}</span>}
              </div>
              <div className="flex-1 overflow-y-auto" style={{ gap: 4, display: "flex", flexDirection: "column" }}>
                {daySigics.map(sig => { const docs = sig.doctors || []; return (
                  <div key={sig.id} className="bg-red-50 border border-red-100 rounded p-1 text-red-700" style={{ fontSize: 9, lineHeight: 1.3 }}>
                    <strong className="block mb-0.5">{sig.period}</strong>
                    <div className="truncate" style={{ opacity: 0.9 }}>{getDocName(docs[0])}</div>
                    {docs[1] && <div className="truncate" style={{ opacity: 0.9 }}>{getDocName(docs[1])}</div>}
                  </div>
                ); })}
              </div>
            </div>
          );
        })}
      </div>
      {/* SIGIC day modal */}
      {selectedDate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(15,23,42,0.4)", backdropFilter: "blur(4px)" }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full overflow-hidden" style={{ maxWidth: 520 }}>
            <div className="bg-red-50 px-5 py-4 flex justify-between items-center" style={{ borderBottom: "1px solid #fecaca" }}>
              <div><h3 className="text-lg font-black text-red-700">SIGIC — {selectedDate.getDate()} {MONTHS[selectedDate.getMonth()]}</h3><p className="text-xs text-red-400 font-bold uppercase mt-0.5 tracking-wider">{DAYS[selectedDate.getDay() === 0 ? 6 : selectedDate.getDay() - 1]}</p></div>
              <button onClick={() => setSelectedDate(null)} className="p-1.5 text-red-400 hover:text-red-700 rounded-lg"><X size={20} /></button>
            </div>
            <div className="p-5 overflow-y-auto bg-slate-50" style={{ maxHeight: "70vh" }}>
              <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider pb-2 mb-3" style={{ borderBottom: "1px solid #e2e8f0" }}>Sessões Registadas</h4>
              {safeSigics.filter(s => s.date === isoD(selectedDate)).length === 0 ? (
                <p className="text-sm text-slate-400 italic py-4 bg-white rounded-lg border border-dashed border-slate-200 text-center mb-4">Nenhuma sessão SIGIC neste dia.</p>
              ) : (
                <div className="flex flex-col gap-3 mb-4">{safeSigics.filter(s => s.date === isoD(selectedDate)).map(sig => {
                  const docs = sig.doctors || [];
                  return (
                    <div key={sig.id} className="bg-white shadow-sm border border-slate-200 p-4 rounded-xl flex items-start gap-4">
                      <div className="bg-red-50 text-red-500 p-2.5 rounded-xl border border-red-100"><Users size={20} /></div>
                      <div className="flex-1">
                        <div className="flex justify-between items-start"><span className="font-black text-red-600 uppercase tracking-widest bg-red-50 px-2 py-0.5 rounded" style={{ fontSize: 10 }}>{sig.period}</span><button onClick={() => removeSigic(sig.id)} className="text-slate-300 hover:text-red-600 p-1.5 rounded-lg"><Trash2 size={16} /></button></div>
                        <ul className="mt-3" style={{ listStyle: "none", padding: 0, margin: 0 }}>{docs.map((did, i) => (<li key={i} className="text-sm font-semibold text-slate-700 flex items-center gap-2 mb-1"><span className="text-slate-400 font-bold font-mono" style={{ fontSize: 10, width: 20 }}>{i + 1}º</span> {getDocName(did)}</li>))}</ul>
                        {sig.notes && <p className="text-xs text-slate-500 mt-3 pt-2 flex gap-1.5 items-start" style={{ borderTop: "1px solid #f1f5f9" }}><Info size={14} className="text-slate-400" style={{ flexShrink: 0 }} /> {sig.notes}</p>}
                      </div>
                    </div>
                  );
                })}</div>
              )}
              <div className="bg-white shadow-md border border-red-100 rounded-xl p-5 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1.5 h-full bg-red-500" />
                <h4 className="text-xs font-black text-red-600 uppercase tracking-wider mb-4 flex items-center gap-2"><Plus size={14} /> Nova Sessão</h4>
                <div className="flex flex-col gap-4">
                  <div><label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5" style={{ fontSize: 10 }}>Turno *</label><select value={form.period} onChange={e => setForm({ ...form, period: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 outline-none">{PERIODS.map(p => <option key={p} value={p}>{p}</option>)}</select></div>
                  <div className="grid grid-cols-2 gap-4">
                    <div><label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5" style={{ fontSize: 10 }}>1º Cirurgião *</label><select value={form.doctor1} onChange={e => setForm({ ...form, doctor1: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 outline-none"><option value="">Selecione...</option>{team.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}</select></div>
                    <div><label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5" style={{ fontSize: 10 }}>2º Cirurgião</label><select value={form.doctor2} onChange={e => setForm({ ...form, doctor2: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 outline-none"><option value="">Nenhum...</option>{team.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}</select></div>
                  </div>
                  <div><label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5" style={{ fontSize: 10 }}>Notas</label><input value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="Opcional..." className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 outline-none" /></div>
                  <button onClick={addSigic} className="w-full py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold text-sm rounded-lg flex items-center justify-center gap-2 mt-2"><Save size={16} /> Guardar SIGIC</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// --- Tab: Absences ---
function AbsencesTab({ absences, setAbsences, team }) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ memberId: "", type: "ferias", start: "", end: "", notes: "" });
  const add = () => { if (!form.memberId || !form.start || !form.end) return; if (form.start > form.end) { alert("Data início deve ser anterior."); return; } setAbsences(p => [...(Array.isArray(p) ? p : []), { ...form, id: `a${Date.now()}` }]); setForm({ memberId: "", type: "ferias", start: "", end: "", notes: "" }); setShowForm(false); };
  const remove = id => { if (confirm("Remover?")) setAbsences(p => p.filter(x => x.id !== id)); };
  const safeAbs = Array.isArray(absences) ? absences : [];
  const sorted = [...safeAbs].sort((a, b) => (a?.start || "").localeCompare(b?.start || ""));
  return (
    <div className="bg-white rounded-b-xl shadow-sm border border-slate-200 p-6" style={{ borderTopRightRadius: 12 }}>
      <div className="flex justify-between items-center mb-6">
        <div><h3 className="text-lg font-bold text-slate-800 flex items-center gap-2"><Tent size={20} color="#f97316" /> Férias & Ausências</h3><p className="text-xs text-slate-500 mt-1">Bloqueiam automaticamente o horário.</p></div>
        <button onClick={() => setShowForm(!showForm)} className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-xs ${showForm ? "bg-red-50 text-red-600" : "bg-slate-800 text-white"}`}>{showForm ? <><X size={14} /> Cancelar</> : <><Plus size={14} /> Nova Ausência</>}</button>
      </div>
      {showForm && (
        <div className="bg-slate-50 rounded-xl p-5 mb-6 border border-slate-200">
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div><label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5" style={{ fontSize: 11 }}>Membro *</label><select value={form.memberId} onChange={e => setForm({ ...form, memberId: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white outline-none"><option value="">Selecionar...</option>{team.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}</select></div>
            <div><label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5" style={{ fontSize: 11 }}>Tipo</label><select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white outline-none">{ABSENCE_TYPES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}</select></div>
            <div><label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5" style={{ fontSize: 11 }}>De *</label><input type="date" value={form.start} onChange={e => setForm({ ...form, start: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white outline-none" /></div>
            <div><label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5" style={{ fontSize: 11 }}>Até *</label><input type="date" value={form.end} onChange={e => setForm({ ...form, end: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white outline-none" /></div>
          </div>
          <div className="mb-4"><label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5" style={{ fontSize: 11 }}>Notas</label><input value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="Ex: Congresso SPORL..." className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white outline-none" /></div>
          <button onClick={add} className="px-6 py-2 bg-teal-500 text-white font-bold text-sm rounded-lg flex items-center gap-2"><Save size={16} /> Guardar</button>
        </div>
      )}
      <div className="flex flex-wrap gap-2 mb-6">{ABSENCE_TYPES.map(t => (<div key={t.id} className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-xs font-semibold" style={{ backgroundColor: hexToRgba(t.color, 0.05), borderColor: hexToRgba(t.color, 0.15), color: t.color }}><span>{t.icon}</span>{t.label}</div>))}</div>
      {sorted.length === 0 ? (<div className="text-center py-12 text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200"><div className="text-4xl mb-3">🏖️</div><p className="text-sm font-semibold">Nenhuma ausência registada.</p></div>)
        : (<div className="flex flex-col gap-3">{sorted.map(ab => { const at = getAbsType(ab.type); const member = team.find(m => m.id === ab.memberId); const startD = new Date(ab.start + "T00:00:00"); const endD = new Date(ab.end + "T00:00:00"); const days = Math.ceil((endD - startD) / 864e5) + 1; const isPast = endD < new Date();
          return (<div key={ab.id} className="flex items-center gap-4 p-4 rounded-xl shadow-sm" style={{ borderLeft: `4px solid ${at?.color || "#ccc"}`, border: "1px solid #f1f5f9", borderLeftWidth: 4, borderLeftColor: at?.color || "#ccc", opacity: isPast ? 0.6 : 1, background: isPast ? "#fafafa" : "#fff" }}>
            <div className="text-2xl w-10 h-10 flex items-center justify-center bg-slate-100 rounded-full" style={{ flexShrink: 0 }}>{at?.icon || "📌"}</div>
            <div className="flex-1" style={{ minWidth: 0 }}>
              <div className="flex items-center gap-2 mb-1 flex-wrap"><span className="text-sm font-bold text-slate-800">{member?.name || "?"}</span><span className="font-bold px-2 py-0.5 rounded-full" style={{ fontSize: 10, color: at?.color, backgroundColor: hexToRgba(at?.color || "#ccc", 0.1) }}>{at?.label}</span>{isPast && <span className="text-slate-400 italic bg-slate-200 px-2 py-0.5 rounded-full" style={{ fontSize: 10 }}>Passado</span>}</div>
              <div className="text-xs text-slate-500 font-mono">{fd(startD)} — {fd(endD)} <span className="font-semibold text-slate-600">({days}d)</span></div>
              {ab.notes && <div className="text-xs text-slate-600 mt-1.5 flex items-start gap-1"><Info size={14} className="text-slate-400" style={{ flexShrink: 0 }} /> {ab.notes}</div>}
            </div>
            <button onClick={() => remove(ab.id)} className="p-2 text-slate-300 hover:text-red-500 rounded-lg"><Trash2 size={18} /></button>
          </div>);
        })}</div>)}
    </div>
  );
}

// --- Tab: Patients ---
function PatientsTab({ patients, setPatients, team }) {
  const [showForm, setShowForm] = useState(false);
  const ef = { name: "", bed: "", doctor: "", status: "estavel", diagnosis: "", notes: "", admission: new Date().toISOString().slice(0, 10) };
  const [form, setForm] = useState(ef);
  const add = () => { if (!form.name.trim()) return; setPatients(p => [...(Array.isArray(p) ? p : []), { ...form, id: `p${Date.now()}` }]); setForm(ef); setShowForm(false); };
  const remove = id => { if (confirm("Alta?")) setPatients(p => p.filter(x => x.id !== id)); };
  const updSt = (id, st) => setPatients(p => p.map(x => x.id === id ? { ...x, status: st } : x));
  const updNotes = (id, n) => setPatients(p => p.map(x => x.id === id ? { ...x, notes: n } : x));
  const safePt = Array.isArray(patients) ? patients : [];
  return (
    <div className="bg-white rounded-b-xl shadow-sm border border-slate-200 p-6" style={{ borderTopRightRadius: 12 }}>
      <div className="flex justify-between items-center mb-6">
        <div><h3 className="text-lg font-bold text-slate-800 flex items-center gap-2"><Stethoscope size={20} color="#3b82f6" /> Doentes Internados</h3><p className="text-xs text-blue-600 font-medium bg-blue-50 px-2 py-0.5 rounded-full inline-block mt-1">{safePt.length} doente{safePt.length !== 1 ? "s" : ""}</p></div>
        <button onClick={() => setShowForm(!showForm)} className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-xs ${showForm ? "bg-red-50 text-red-600" : "bg-slate-800 text-white"}`}>{showForm ? <><X size={14} /> Cancelar</> : <><Plus size={14} /> Novo Doente</>}</button>
      </div>
      {showForm && (<div className="bg-slate-50 rounded-xl p-5 mb-6 border border-slate-200">
        <div className="grid grid-cols-3 gap-4 mb-4">
          <div><label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5" style={{ fontSize: 11 }}>Nome *</label><input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Nome..." className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white outline-none" /></div>
          <div><label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5" style={{ fontSize: 11 }}>Cama</label><input value={form.bed} onChange={e => setForm({ ...form, bed: e.target.value })} placeholder="Ex: 4B" className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white outline-none" /></div>
          <div><label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5" style={{ fontSize: 11 }}>Admissão</label><input type="date" value={form.admission} onChange={e => setForm({ ...form, admission: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white outline-none" /></div>
        </div>
        <div className="grid grid-cols-3 gap-4 mb-4">
          <div><label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5" style={{ fontSize: 11 }}>Médico</label><select value={form.doctor} onChange={e => setForm({ ...form, doctor: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white outline-none"><option value="">Selecionar...</option>{team.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}</select></div>
          <div><label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5" style={{ fontSize: 11 }}>Estado</label><select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white outline-none">{PATIENT_STATUS.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}</select></div>
          <div><label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5" style={{ fontSize: 11 }}>Diagnóstico</label><input value={form.diagnosis} onChange={e => setForm({ ...form, diagnosis: e.target.value })} placeholder="..." className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white outline-none" /></div>
        </div>
        <div className="mb-4"><label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5" style={{ fontSize: 11 }}>Notas</label><textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white outline-none" style={{ resize: "vertical" }} /></div>
        <button onClick={add} className="px-6 py-2 bg-blue-600 text-white font-bold text-sm rounded-lg flex items-center gap-2"><Save size={16} /> Adicionar</button>
      </div>)}
      {safePt.length === 0 ? (<div className="text-center py-12 text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200"><div className="text-4xl mb-3">🏥</div><p className="text-sm font-semibold">Sem doentes internados.</p></div>)
        : (<div className="grid grid-cols-1 gap-4">{safePt.map(pt => { const st = PATIENT_STATUS.find(s => s.id === pt.status); const doc = team.find(m => m.id === pt.doctor); const days = pt.admission ? Math.ceil((new Date() - new Date(pt.admission + "T00:00:00")) / 864e5) : 0;
          return (<div key={pt.id} className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 flex flex-col relative overflow-hidden">
            <div className="absolute top-0 left-0 w-1.5 h-full" style={{ backgroundColor: st?.color || "#ccc" }} />
            <div className="flex gap-4 pl-3">
              <div className="flex flex-col items-center justify-center p-2 bg-slate-50 rounded-lg border border-slate-100" style={{ minWidth: 48, height: 56 }}><span className="text-lg font-bold font-mono text-slate-700">{pt.bed || "—"}</span><span className="text-slate-400 font-bold uppercase" style={{ fontSize: 9 }}>Cama</span></div>
              <div className="flex-1" style={{ minWidth: 0 }}><h4 className="text-sm font-bold text-slate-800 truncate">{pt.name}</h4><p className="text-xs text-slate-500 truncate mb-2">{pt.diagnosis || "Sem diagnóstico"}</p><div className="flex flex-wrap gap-2 text-slate-500" style={{ fontSize: 10 }}><span className="bg-slate-100 px-2 py-0.5 rounded">👨‍⚕️ {doc?.name || "N/A"}</span><span className="bg-slate-100 px-2 py-0.5 rounded">📅 {days}d</span></div></div>
              <div className="flex flex-col justify-between items-end gap-2">
                <select value={pt.status} onChange={e => updSt(pt.id, e.target.value)} className="font-bold px-2 py-1 rounded-md bg-white outline-none cursor-pointer" style={{ fontSize: 10, borderWidth: 2, borderColor: st?.color || "#ccc", color: st?.color || "#666" }}>{PATIENT_STATUS.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}</select>
                <button onClick={() => remove(pt.id)} className="text-xs text-slate-400 hover:text-red-600 px-2 py-1 rounded flex items-center gap-1"><Trash2 size={12} /> Alta</button>
              </div>
            </div>
            <div className="mt-3 pl-3"><textarea value={pt.notes || ""} onChange={e => updNotes(pt.id, e.target.value)} placeholder="Notas clínicas..." rows={2} className="w-full px-3 py-2 bg-slate-50 border border-slate-100 rounded-lg text-xs text-slate-700 outline-none" style={{ resize: "none" }} /></div>
          </div>);
        })}</div>)}
    </div>
  );
}

// --- Tab: Weekly Stats ---
function StatsTab({ schedule, template, team, weekKey: wkk, absences, weekDates, sigics }) {
  const { mh, mUrg, mLivre, ct, totWork, totLivre } = calcWeekStats(schedule, template, team, wkk, absences, weekDates, sigics);
  return (
    <div className="bg-white rounded-b-xl shadow-sm border border-slate-200 p-6" style={{ borderTopRightRadius: 12 }}>
      <div className="grid grid-cols-1 gap-8" style={{ gridTemplateColumns: "1fr 1fr" }}>
        <div>
          <h3 className="text-base font-bold text-slate-800 flex items-center gap-2 mb-1"><BarChart3 size={18} color="#0d9488" /> Carga Horária</h3>
          <p className="text-xs text-slate-500 mb-4">Horário Livre não contabilizado.</p>
          {["specialist", "resident"].map(role => (<div key={role} className="mb-5">
            <div className="font-bold uppercase tracking-widest mb-2 flex items-center gap-2" style={{ fontSize: 9, color: role === "specialist" ? "#1abc9c" : "#2e86c1" }}>{role === "specialist" ? "Especialistas" : "Internos"}<div className="flex-1" style={{ height: 1, background: "#f1f5f9" }} /></div>
            {team.filter(m => m.role === role).map(m => { const h = mh[m.id] || 0; const rm = team.filter(x => x.role === role); const avg = rm.reduce((s, x) => s + (mh[x.id] || 0), 0) / rm.length; const dev = Math.abs(h - avg); const col = dev < 4 ? "#27ae60" : dev < 10 ? "#f39c12" : "#e74c3c";
              return (<div key={m.id} className="flex items-center gap-3 mb-1.5"><span className="text-xs font-semibold text-slate-700 text-right truncate" style={{ width: 96 }}>{m.name}</span><div className="flex-1 rounded-full overflow-hidden relative border" style={{ height: 20, background: "#f1f5f9", borderColor: "rgba(226,232,240,0.5)" }}><div className="h-full rounded-full" style={{ width: `${Math.min((h / 60) * 100, 100)}%`, background: `linear-gradient(90deg,${hexToRgba(col, 0.7)},${col})`, minWidth: h > 0 ? 24 : 0, transition: "width 0.5s", display: "flex", alignItems: "center", justifyContent: "flex-end", paddingRight: 8 }}>{(h / 60) * 100 > 15 && <span className="text-white font-bold font-mono" style={{ fontSize: 9 }}>{h}h</span>}</div>{(h / 60) * 100 <= 15 && <span className="absolute font-bold text-slate-600 font-mono" style={{ left: 6, top: "50%", transform: "translateY(-50%)", fontSize: 9 }}>{h}h</span>}</div></div>);
            })}
          </div>))}
          <div className="pt-5" style={{ borderTop: "2px solid #f1f5f9" }}>
            <h3 className="text-sm font-bold text-orange-600 flex items-center gap-2 mb-3">🚨 Urgência</h3>
            <div className="grid grid-cols-2 gap-2">{team.map(m => { const u = mUrg[m.id] || 0; return (<div key={m.id} className="flex items-center gap-2 p-1.5 rounded-md border" style={{ background: "rgba(253,242,233,0.5)", borderColor: "rgba(253,186,116,0.5)" }}><span className="flex-1 text-xs font-semibold text-slate-700 truncate">{m.name}</span><span className="font-bold font-mono px-2 py-0.5 rounded" style={{ fontSize: 11, background: u > 0 ? "#fef3c7" : "transparent", color: u > 0 ? "#d97706" : "#94a3b8" }}>{u}h</span></div>); })}</div>
          </div>
        </div>
        <div className="bg-slate-50 p-5 rounded-xl border border-slate-100" style={{ height: "fit-content" }}>
          <h3 className="text-base font-bold text-slate-800 mb-4">Resumo por Categoria</h3>
          <div className="flex flex-col gap-2">{CATEGORIES.map(cat => { const isLivre = cat.id === "livre"; const pct = totWork + totLivre > 0 ? (ct[cat.id] / (totWork + totLivre)) * 100 : 0;
            return (<div key={cat.id} className="flex items-center gap-3 p-2 rounded-lg bg-white border border-slate-100 shadow-sm" style={{ opacity: isLivre ? 0.7 : 1 }}><span className="w-3 h-3 rounded-full" style={{ backgroundColor: cat.color, flexShrink: 0 }} /><span className="flex-1 text-xs font-semibold text-slate-700">{cat.label}{isLivre ? " *" : ""}</span><div className="text-right"><div className="text-sm font-bold font-mono" style={{ color: cat.color }}>{ct[cat.id] || 0}h</div><div className="text-slate-400 font-mono" style={{ fontSize: 9 }}>{pct.toFixed(0)}%</div></div></div>);
          })}</div>
          <div className="mt-5 pt-4" style={{ borderTop: "2px dashed #e2e8f0" }}>
            <div className="flex justify-between items-center mb-1"><span className="text-sm font-bold text-slate-800">Total Trabalho</span><span className="text-lg font-black text-slate-800 font-mono">{totWork}h</span></div>
            <div className="flex justify-between items-center text-xs text-slate-500"><span>Horário Livre</span><span className="font-mono font-medium">{totLivre}h</span></div>
          </div>
        </div>
      </div>
    </div>
  );
}

// --- Tab: Monthly/Yearly Stats ---
function LongStatsTab({ schedule, template, team, absences, sigics }) {
  const [viewYear, setViewYear] = useState(new Date().getFullYear());
  const [viewMonth, setViewMonth] = useState(new Date().getMonth());
  const [mode, setMode] = useState("month");
  const weeks = useMemo(() => {
    const ws = []; let start, end;
    if (mode === "month") { start = new Date(viewYear, viewMonth, 1); end = new Date(viewYear, viewMonth + 1, 0); }
    else { start = new Date(viewYear, 0, 1); end = new Date(viewYear, 11, 31); }
    let mon = getMonday(start); const endMon = getMonday(end); endMon.setDate(endMon.getDate() + 7);
    while (mon <= endMon) { ws.push(new Date(mon)); mon = new Date(mon); mon.setDate(mon.getDate() + 7); }
    return ws;
  }, [viewYear, viewMonth, mode]);
  const agg = useMemo(() => {
    const mh = {}, mUrg = {}, mLivre = {}, ct = {};
    CATEGORIES.forEach(c => { ct[c.id] = 0; }); team.forEach(m => { mh[m.id] = 0; mUrg[m.id] = 0; mLivre[m.id] = 0; });
    weeks.forEach(mon => { const wkk = makeWk(mon); const wd = getWeekDates(mon);
      team.forEach(m => { DAYS.forEach((d, di) => { PERIODS.forEach(p => {
        const date = wd[di]; const dateStr = isoD(date);
        if (mode === "month" && date.getMonth() !== viewMonth) return;
        if (isAbsent(absences, m.id, date) || isHoliday(date)) return;
        const sk = `${wkk}|${m.id}|${d}|${p}`; const tk = `TPL|${m.id}|${d}|${p}`;
        const hasSigic = Array.isArray(sigics) && sigics.some(s => { const docs = s.doctors || (s.memberId ? [s.memberId] : []); return docs.includes(m.id) && s.date === dateStr && s.period === p; });
        const catId = schedule[sk] || (hasSigic ? "sigic" : null) || template[tk] || null;
        if (!catId) return; const h = PHOURS[p]; ct[catId] += h;
        if (WORK_EXCLUDED.includes(catId)) { mLivre[m.id] += h; } else { mh[m.id] += h; }
        if (URGENCY_IDS.includes(catId)) { mUrg[m.id] += h; }
      }); }); });
    });
    return { mh, mUrg, mLivre, ct, totWork: Object.values(ct).reduce((a, b) => a + b, 0) - (ct["livre"] || 0), totLivre: ct["livre"] || 0 };
  }, [weeks, schedule, template, team, absences, viewMonth, mode, sigics]);
  const maxWork = Math.max(...team.map(m => agg.mh[m.id] || 0), 1);
  return (
    <div className="bg-white rounded-b-xl shadow-sm border border-slate-200 p-6" style={{ borderTopRightRadius: 12 }}>
      <div className="flex flex-wrap items-center gap-4 mb-8 bg-slate-50 p-2 rounded-xl border border-slate-100">
        <div className="flex rounded-lg p-1" style={{ background: "rgba(226,232,240,0.5)" }}>
          <button onClick={() => setMode("month")} className={`px-4 py-1.5 rounded-md text-xs font-bold ${mode === "month" ? "bg-white text-slate-800 shadow-sm" : "text-slate-500"}`}>Mensal</button>
          <button onClick={() => setMode("year")} className={`px-4 py-1.5 rounded-md text-xs font-bold ${mode === "year" ? "bg-white text-slate-800 shadow-sm" : "text-slate-500"}`}>Anual</button>
        </div>
        {mode === "month" && (<div className="flex items-center gap-2 bg-white px-2 py-1 rounded-lg border border-slate-200 shadow-sm">
          <button onClick={() => { if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); } else setViewMonth(m => m - 1); }} className="p-1 hover:bg-slate-100 rounded text-slate-600"><ChevronLeft size={16} /></button>
          <span className="text-sm font-bold text-slate-800" style={{ minWidth: 120, textAlign: "center" }}>{MONTHS[viewMonth]} {viewYear}</span>
          <button onClick={() => { if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); } else setViewMonth(m => m + 1); }} className="p-1 hover:bg-slate-100 rounded text-slate-600"><ChevronRight size={16} /></button>
        </div>)}
        {mode === "year" && (<div className="flex items-center gap-2 bg-white px-2 py-1 rounded-lg border border-slate-200 shadow-sm">
          <button onClick={() => setViewYear(y => y - 1)} className="p-1 hover:bg-slate-100 rounded text-slate-600"><ChevronLeft size={16} /></button>
          <span className="text-sm font-bold text-slate-800" style={{ minWidth: 60, textAlign: "center" }}>{viewYear}</span>
          <button onClick={() => setViewYear(y => y + 1)} className="p-1 hover:bg-slate-100 rounded text-slate-600"><ChevronRight size={16} /></button>
        </div>)}
      </div>
      <div className="grid grid-cols-1 gap-8" style={{ gridTemplateColumns: "1fr 1fr" }}>
        <div>
          <h3 className="text-base font-bold text-slate-800 mb-4 flex items-center gap-2"><LineChart size={18} color="#3b82f6" /> Horas por Membro</h3>
          <div className="grid gap-2 mb-3 pb-2" style={{ gridTemplateColumns: "120px 1fr 60px 60px 70px", borderBottom: "2px solid #f1f5f9" }}>
            <span className="text-slate-400 font-bold uppercase tracking-wider" style={{ fontSize: 10 }}>Médico</span><span className="text-blue-500 font-bold uppercase tracking-wider" style={{ fontSize: 10 }}>Trabalho</span><span className="text-orange-500 font-bold uppercase tracking-wider text-center" style={{ fontSize: 10 }}>Urg.</span><span className="text-slate-400 font-bold uppercase tracking-wider text-center" style={{ fontSize: 10 }}>Livre</span><span className="text-slate-800 font-bold uppercase tracking-wider text-right pr-2" style={{ fontSize: 10 }}>SOMA</span>
          </div>
          {["specialist", "resident"].map(role => (<div key={role} className="mb-6">
            <div className="font-bold uppercase tracking-widest mb-2" style={{ fontSize: 9, color: role === "specialist" ? "#1abc9c" : "#2e86c1" }}>{role === "specialist" ? "Especialistas" : "Internos"}</div>
            {team.filter(m => m.role === role).map(m => { const w = agg.mh[m.id] || 0; const u = agg.mUrg[m.id] || 0; const l = agg.mLivre[m.id] || 0;
              return (<div key={m.id} className="grid gap-2 mb-2 items-center bg-slate-50 p-1.5 rounded-lg" style={{ gridTemplateColumns: "120px 1fr 60px 60px 70px" }}>
                <span className="text-xs font-semibold text-slate-700 truncate">{m.name}</span>
                <div className="rounded-full overflow-hidden relative" style={{ height: 16, background: "rgba(226,232,240,0.5)" }}><div className="h-full bg-blue-500" style={{ width: `${Math.min((w / maxWork) * 100, 100)}%`, transition: "width 0.5s" }} /></div>
                <span className="text-center font-bold font-mono text-orange-600 bg-orange-50 rounded py-0.5" style={{ fontSize: 11 }}>{u}h</span>
                <span className="text-center font-bold font-mono text-slate-500" style={{ fontSize: 11 }}>{l}h</span>
                <span className="text-right text-xs font-black font-mono text-slate-800 pr-2">{w + l}h</span>
              </div>);
            })}
          </div>))}
        </div>
        <div>
          <div className="bg-slate-50 p-5 rounded-xl border border-slate-100 mb-6">
            <h3 className="text-base font-bold text-slate-800 mb-4">Distribuição de Categoria</h3>
            <div className="flex flex-col gap-2">{CATEGORIES.map(cat => { const isLivre = cat.id === "livre"; const total = agg.totWork + agg.totLivre; const pct = total > 0 ? (agg.ct[cat.id] / total) * 100 : 0;
              return (<div key={cat.id} className="flex items-center gap-3 bg-white p-2 rounded-lg border border-slate-100" style={{ opacity: isLivre ? 0.7 : 1 }}><span className="w-3 h-3 rounded-full" style={{ backgroundColor: cat.color, flexShrink: 0 }} /><span className="flex-1 text-xs font-semibold text-slate-700">{cat.label}{isLivre ? " *" : ""}</span><span className="text-sm font-bold font-mono text-right" style={{ color: cat.color, minWidth: 50 }}>{agg.ct[cat.id] || 0}h</span><span className="text-slate-400 font-mono bg-slate-50 px-1 py-0.5 rounded text-right" style={{ fontSize: 10, minWidth: 40 }}>{pct.toFixed(0)}%</span></div>);
            })}</div>
            <div className="mt-5 pt-4" style={{ borderTop: "2px dashed #e2e8f0" }}>
              <div className="flex justify-between items-center text-sm font-bold text-slate-800 bg-white p-2 rounded-lg border border-slate-100 mb-2"><span>Total Trabalho</span><span className="font-mono text-lg">{agg.totWork}h</span></div>
              <div className="flex justify-between items-center text-xs font-semibold text-orange-600 bg-orange-50 p-2 rounded-lg border border-orange-100"><span>Total Urgência</span><span className="font-mono">{Object.values(agg.mUrg).reduce((a, b) => a + b, 0)}h</span></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════
// MAIN APP
// ═══════════════════════════════════════
export default function App() {
  const [team, setTeam] = useState(DEFAULT_TEAM);
  const [schedule, setSchedule] = useState({});
  const [template, setTemplate] = useState({});
  const [absences, setAbsences] = useState([]);
  const [patients, setPatients] = useState([]);
  const [sigics, setSigics] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [curMon, setCurMon] = useState(() => getMonday(new Date()));
  const [tab, setTab] = useState("schedule");
  const [showCal, setShowCal] = useState(false);

  const weekKey = makeWk(curMon);
  const weekDates = useMemo(() => getWeekDates(curMon), [curMon]);
  const isThisWeek = makeWk(getMonday(new Date())) === weekKey;
  const weekHolidays = useMemo(() => weekDates.map(d => getHolidayName(d)), [weekDates]);

  useEffect(() => {
    loadAll().then(d => {
      if (d) {
        if (d.team && Array.isArray(d.team)) setTeam(d.team);
        if (d.schedule) setSchedule(d.schedule);
        if (d.template) setTemplate(d.template);
        if (d.absences && Array.isArray(d.absences)) setAbsences(d.absences);
        if (d.patients && Array.isArray(d.patients)) setPatients(d.patients);
        if (d.sigics && Array.isArray(d.sigics)) setSigics(d.sigics);
      }
      setLoaded(true);
    });
  }, []);

  useEffect(() => { if (loaded) saveAll({ team, schedule, template, absences, patients, sigics }); }, [team, schedule, template, absences, patients, sigics, loaded]);

  const updateCell = useCallback((key, catId) => { setSchedule(prev => { const n = { ...prev }; if (catId === null) delete n[key]; else n[key] = catId; return n; }); }, []);
  const rename = useCallback((id, name) => { setTeam(prev => prev.map(m => m.id === id ? { ...m, name } : m)); }, []);
  const prevWeek = () => { const d = new Date(curMon); d.setDate(d.getDate() - 7); setCurMon(d); };
  const nextWeek = () => { const d = new Date(curMon); d.setDate(d.getDate() + 7); setCurMon(d); };
  const clearWeek = () => { if (confirm("Limpar alterações manuais desta semana?")) { setSchedule(prev => { const n = { ...prev }; Object.keys(n).forEach(k => { if (k.startsWith(weekKey + "|")) delete n[k]; }); return n; }); } };

  const getEffective = (mid, day, period, dateStr) => {
    const sk = `${weekKey}|${mid}|${day}|${period}`;
    if (schedule[sk]) return schedule[sk];
    if (Array.isArray(sigics) && sigics.some(s => { const docs = s.doctors || (s.memberId ? [s.memberId] : []); return docs.includes(mid) && s.date === dateStr && s.period === period; })) return "sigic";
    return template[`TPL|${mid}|${day}|${period}`] || null;
  };
  const isFromTpl = (mid, day, period, dateStr) => {
    const sk = `${weekKey}|${mid}|${day}|${period}`;
    const hasSigic = Array.isArray(sigics) && sigics.some(s => { const docs = s.doctors || (s.memberId ? [s.memberId] : []); return docs.includes(mid) && s.date === dateStr && s.period === period; });
    return !schedule[sk] && !hasSigic && !!template[`TPL|${mid}|${day}|${period}`];
  };

  if (!loaded) return (<div className="flex items-center justify-center bg-slate-50 text-slate-500 font-medium" style={{ minHeight: "100vh" }}><div className="flex flex-col items-center gap-4"><div className="w-10 h-10 border-4 border-teal-500 rounded-full" style={{ borderTopColor: "transparent", animation: "spin 1s linear infinite" }} /><style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>A carregar Healqo...</div></div>);

  const TABS = [
    { id: "schedule", label: "Horário", Icon: Calendar },
    { id: "template", label: "Base", Icon: CalendarDays },
    { id: "sigic", label: "SIGIC", Icon: Activity },
    { id: "absences", label: "Ausências", Icon: Tent },
    { id: "stats", label: "Semana", Icon: BarChart3 },
    { id: "longstats", label: "Mês/Ano", Icon: LineChart },
    { id: "patients", label: "Internados", Icon: Stethoscope },
  ];

  return (
    <div className="min-h-screen bg-slate-100 pb-10" style={{ fontFamily: "'Inter',system-ui,sans-serif" }}>
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet" />

      {/* Header */}
      <div className="bg-slate-900 px-6 py-5 relative overflow-hidden shadow-md">
        <div className="absolute rounded-full pointer-events-none" style={{ top: -40, right: -20, width: 192, height: 192, background: "rgba(20,184,166,0.1)", filter: "blur(40px)" }} />
        <div className="flex flex-wrap items-center justify-between gap-4 relative" style={{ maxWidth: 1280, margin: "0 auto", zIndex: 10 }}>
          <div>
            <h1 className="text-3xl font-black text-white tracking-tight flex items-baseline" style={{ margin: 0 }}>healqo<span className="text-teal-400" style={{ fontSize: 36 }}>.</span></h1>
            <p className="text-xs text-slate-400 font-medium tracking-wide uppercase" style={{ margin: "2px 0 0" }}>Gestão de Horários · ORL</p>
          </div>
          <div className="flex items-center gap-2 p-1.5 rounded-xl border border-slate-700" style={{ background: "rgba(30,41,59,0.5)", backdropFilter: "blur(4px)" }}>
            <button onClick={prevWeek} className="p-2 rounded-lg text-slate-300 hover:text-white hover:bg-slate-700"><ChevronLeft size={20} /></button>
            <button onClick={() => setShowCal(true)} className="px-4 py-1.5 rounded-lg border border-slate-600 bg-slate-800 hover:bg-slate-700 flex flex-col items-center" style={{ minWidth: 190 }}>
              <div className="text-teal-400 font-bold uppercase tracking-wider mb-0.5" style={{ fontSize: 10 }}>Semana {getWN(curMon)}{isThisWeek ? " • Atual" : ""}</div>
              <div className="text-sm text-white font-bold font-mono">{fd(weekDates[0])} <span className="text-slate-400 mx-1">—</span> {fd(weekDates[6])}</div>
            </button>
            <button onClick={nextWeek} className="p-2 rounded-lg text-slate-300 hover:text-white hover:bg-slate-700"><ChevronRight size={20} /></button>
          </div>
        </div>
      </div>

      {showCal && <YearCalendar currentMonday={curMon} onSelect={setCurMon} onClose={() => setShowCal(false)} />}

      <div className="px-4 mt-6" style={{ maxWidth: 1280, margin: "24px auto 0" }}>
        {/* Tabs */}
        <div className="flex flex-wrap gap-1 mb-0" style={{ borderBottom: "1px solid #cbd5e1" }}>
          {TABS.map(t => { const Icon = t.Icon; return (
            <button key={t.id} onClick={() => setTab(t.id)}
              className="flex items-center gap-2 px-4 py-3 font-bold text-sm"
              style={{
                borderBottom: tab === t.id ? "2px solid #14b8a6" : "2px solid transparent",
                color: tab === t.id ? "#0f766e" : "#64748b",
                background: tab === t.id ? "#fff" : "transparent",
                borderTopLeftRadius: 8, borderTopRightRadius: 8,
                boxShadow: tab === t.id ? "0 -4px 6px -1px rgba(0,0,0,0.05)" : "none",
                transition: "all 0.2s",
              }}>
              <Icon size={14} color={tab === t.id ? "#0d9488" : "#94a3b8"} /> {t.label}
            </button>
          ); })}
          <div className="flex-1" />
          {tab === "schedule" && (<div className="flex items-center self-center pr-2"><button onClick={clearWeek} className="flex items-center gap-1.5 px-3 py-1.5 border border-red-200 rounded-md bg-white text-red-600 font-bold text-xs shadow-sm"><Trash2 size={12} /> Restaurar Base</button></div>)}
        </div>

        {/* Content */}
        {tab === "schedule" && (
          <div className="bg-white rounded-b-xl shadow-sm border border-slate-200 p-5 overflow-hidden" style={{ borderTopRightRadius: 12 }}>
            <div className="flex flex-wrap items-center justify-between gap-4 mb-5">
              <div className="flex flex-wrap gap-2">{CATEGORIES.map(cat => (<div key={cat.id} className="flex items-center gap-1.5 px-2 py-1 rounded-md border" style={{ backgroundColor: cat.bg, borderColor: hexToRgba(cat.color, 0.2) }}><span className="font-bold font-mono" style={{ fontSize: 10, color: cat.color }}>{cat.short}</span><span className="text-slate-600 font-medium" style={{ fontSize: 11 }}>{cat.label}</span></div>))}<div className="flex items-center gap-1.5 px-2 py-1 rounded-md border bg-red-50 border-red-200"><span style={{ fontSize: 10 }}>🇵🇹</span><span className="text-red-600 font-bold" style={{ fontSize: 11 }}>Feriado</span></div></div>
              <div className="text-xs font-medium text-slate-500 flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded border border-slate-100"><span className="block rounded-sm" style={{ width: 12, height: 12, border: "1px dashed #93c5fd" }} /> = horário base</div>
            </div>
            <div className="overflow-x-auto pb-4"><div style={{ minWidth: 1050 }}>
              <div className="grid gap-1 mb-1" style={{ gridTemplateColumns: "120px repeat(21, minmax(0,1fr))" }}><div />{DAYS.map((day, di) => { const hol = weekHolidays[di]; return (<div key={day} className="text-center pt-2 pb-1 bg-slate-50 rounded-t-lg" style={{ gridColumn: "span 3", borderBottom: "1px solid #e2e8f0" }}><div className="text-xs font-bold uppercase tracking-wider flex justify-center items-center gap-2" style={{ color: hol ? "#ef4444" : di >= 5 ? "#7c3aed" : "#1e293b" }}>{DS[di]} <span className="font-mono font-semibold" style={{ fontSize: 10, color: hol ? "#f87171" : "#94a3b8" }}>{fd(weekDates[di])}</span></div>{hol && <div className="text-red-600 font-bold mt-0.5 truncate px-1" style={{ fontSize: 9 }}>🇵🇹 {hol}</div>}</div>); })}</div>
              <div className="grid gap-1 mb-3 bg-slate-50 pb-2" style={{ gridTemplateColumns: "120px repeat(21, minmax(0,1fr))", borderBottom: "1px solid #e2e8f0" }}><div />{SLOTS.map((s, i) => (<div key={i} className="flex justify-center mt-1"><PeriodIcon period={s.period} /></div>))}</div>
              {["specialist", "resident"].map(role => (<div key={role} className="mb-4">
                <div className="text-xs font-bold uppercase tracking-widest mb-2 flex items-center gap-2" style={{ fontSize: 10, color: role === "specialist" ? "#1abc9c" : "#2e86c1" }}>{role === "specialist" ? "Especialistas" : "Internos"}<div className="flex-1" style={{ height: 1, background: "#f1f5f9" }} /></div>
                {team.filter(m => m.role === role).map(member => (<div key={member.id} className="grid gap-1 mb-1 items-center group" style={{ gridTemplateColumns: "120px repeat(21, minmax(0,1fr))" }}>
                  <div className="pr-2 py-1 group-hover:bg-slate-50" style={{ transition: "background 0.15s" }}><NameEd member={member} onRename={name => rename(member.id, name)} /></div>
                  {SLOTS.map((s, i) => {
                    const date = weekDates[s.dayIdx]; const hol = weekHolidays[s.dayIdx]; const abs = isAbsent(absences, member.id, date);
                    if (abs) return <div key={i} style={{ padding: 1 }}><BlockedCell absType={abs.type} label={`${getAbsType(abs.type)?.label || ""}: ${abs.notes || ""}`} /></div>;
                    if (hol) return <div key={i} style={{ padding: 1 }}><HolidayCell name={hol} /></div>;
                    const dateStr = isoD(date); const effective = getEffective(member.id, s.day, s.period, dateStr); const fromTpl = isFromTpl(member.id, s.day, s.period, dateStr); const cellKey = `${weekKey}|${member.id}|${s.day}|${s.period}`;
                    const isSigic = !schedule[cellKey] && Array.isArray(sigics) && sigics.some(sig => { const docs = sig.doctors || (sig.memberId ? [sig.memberId] : []); return docs.includes(member.id) && sig.date === dateStr && sig.period === s.period; });
                    return (<div key={i} className="relative w-full"><Cell value={effective} onChange={catId => updateCell(cellKey, catId)} isNight={s.period === "Noite"} isWeekend={s.dayIdx >= 5} />{fromTpl && <div className="absolute rounded-md border-2 border-dashed pointer-events-none" style={{ inset: 1, borderColor: "rgba(52,152,219,0.4)" }} />}{isSigic && <div className="absolute rounded-md border-2 border-dashed pointer-events-none" style={{ inset: 1, borderColor: "rgba(192,57,43,0.5)" }} />}</div>);
                  })}
                </div>))}
              </div>))}
            </div></div>
          </div>
        )}
        {tab === "template" && <TemplateTab template={template} setTemplate={setTemplate} team={team} rename={rename} />}
        {tab === "sigic" && <SigicTab sigics={sigics} setSigics={setSigics} team={team} />}
        {tab === "absences" && <AbsencesTab absences={absences} setAbsences={setAbsences} team={team} />}
        {tab === "stats" && <StatsTab schedule={schedule} template={template} team={team} weekKey={weekKey} absences={absences} weekDates={weekDates} sigics={sigics} />}
        {tab === "longstats" && <LongStatsTab schedule={schedule} template={template} team={team} absences={absences} sigics={sigics} />}
        {tab === "patients" && <PatientsTab patients={patients} setPatients={setPatients} team={team} />}
      </div>
    </div>
  );
}
