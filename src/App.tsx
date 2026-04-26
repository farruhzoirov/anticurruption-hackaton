import { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Coins,
  ChevronRight,
  RotateCcw,
  Skull,
  AlertTriangle,
  Users,
  ArrowLeft,
  Zap,
  Waves,
  X,
  Newspaper,
  MessageCircle,
  Volume2,
  VolumeX,
  Hammer,
} from 'lucide-react';
import { Scene3D, type PlotData } from './Scene3D';

// ============================================================================
//  AUDIO ENGINE — Web Audio API for SFX + speechSynthesis for voice
// ============================================================================

class AudioFX {
  private ctx: AudioContext | null = null;
  muted = false;

  private ensureCtx() {
    if (typeof window === 'undefined') return;
    if (!this.ctx) {
      const AC = (window as any).AudioContext || (window as any).webkitAudioContext;
      if (AC) this.ctx = new AC();
    }
    if (this.ctx?.state === 'suspended') void this.ctx.resume();
  }

  unlock() { this.ensureCtx(); }

  private osc(
    freq: number,
    duration: number,
    gain = 0.18,
    type: OscillatorType = 'sine',
    delay = 0,
  ) {
    if (this.muted) return;
    this.ensureCtx();
    if (!this.ctx) return;
    const t0 = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const env = this.ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    env.gain.setValueAtTime(0, t0);
    env.gain.linearRampToValueAtTime(gain, t0 + 0.012);
    env.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    osc.connect(env).connect(this.ctx.destination);
    osc.start(t0);
    osc.stop(t0 + duration + 0.02);
  }

  click() {
    this.osc(720, 0.06, 0.09, 'square');
  }

  heartbeat(intensity = 1) {
    // Low thump — used for rising tension during a timed decision
    this.osc(58, 0.09, 0.18 * intensity, 'sine');
    this.osc(40, 0.13, 0.12 * intensity, 'sine', 0.04);
  }

  tick() {
    // Sharp clock tick — used for last seconds of countdown
    this.osc(2200, 0.04, 0.08, 'square');
  }

  coin() {
    this.osc(880, 0.08, 0.18, 'triangle');
    this.osc(1320, 0.1, 0.18, 'triangle', 0.06);
    this.osc(1760, 0.06, 0.12, 'sine', 0.12);
  }

  hammer() {
    this.osc(180, 0.05, 0.18, 'square');
    this.osc(110, 0.06, 0.14, 'sawtooth', 0.04);
  }

  drill() {
    this.osc(220, 0.18, 0.08, 'sawtooth');
  }

  buildComplete() {
    // Triumphant major arpeggio: C5–E5–G5–C6
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((n, i) => this.osc(n, 0.22, 0.22, 'triangle', i * 0.11));
    // Shimmer
    this.osc(2093, 0.08, 0.15, 'sine', 0.5);
    this.osc(2637, 0.1, 0.14, 'sine', 0.55);
  }

  disaster() {
    // Low ominous rumble + alarm
    this.osc(72, 0.55, 0.32, 'sawtooth');
    this.osc(56, 0.6, 0.3, 'sawtooth', 0.12);
    this.osc(44, 0.7, 0.28, 'sawtooth', 0.28);
    // Alarm beeps
    this.osc(880, 0.12, 0.2, 'square', 0.5);
    this.osc(660, 0.12, 0.18, 'square', 0.7);
    this.osc(880, 0.12, 0.2, 'square', 0.9);
  }

  victory() {
    const notes = [523, 659, 784, 1047, 1319];
    notes.forEach((n, i) => this.osc(n, 0.25, 0.22, 'triangle', i * 0.13));
  }

  defeat() {
    // Sad descending tones
    const notes = [523, 466, 392, 311];
    notes.forEach((n, i) => this.osc(n, 0.35, 0.2, 'triangle', i * 0.18));
  }

  speak(
    text: string,
    opts: { lang?: string; rate?: number; pitch?: number; volume?: number } = {},
  ) {
    if (this.muted) return;
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    try {
      const u = new SpeechSynthesisUtterance(text);
      u.lang = opts.lang ?? 'uz-UZ';
      u.rate = opts.rate ?? 1.05;
      u.pitch = opts.pitch ?? 1.05;
      u.volume = opts.volume ?? 1;

      const voices = window.speechSynthesis.getVoices();
      if (voices.length > 0) {
        const prefix = u.lang.split('-')[0];
        const voice =
          voices.find((v) => v.lang === u.lang) ??
          voices.find((v) => v.lang.toLowerCase().startsWith(prefix)) ??
          voices.find((v) => v.lang.toLowerCase().startsWith('ru')) ??
          voices.find((v) => v.lang.toLowerCase().startsWith('tr')) ??
          voices.find((v) => v.lang.toLowerCase().startsWith('en')) ??
          null;
        if (voice) u.voice = voice;
      }

      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(u);
    } catch {
      /* graceful no-op */
    }
  }

  cancelSpeech() {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.muted) this.cancelSpeech();
    return this.muted;
  }
}

export const audio = new AudioFX();

// Pre-warm voices list (Chrome loads them async)
if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
  window.speechSynthesis.getVoices();
  window.speechSynthesis.addEventListener?.('voiceschanged', () => {
    window.speechSynthesis.getVoices();
  });
}

// ============================================================================
//  TYPES
// ============================================================================

type BuildingId = 'maktab' | 'shifoxona' | 'bogcha' | 'masjid' | 'sportzal';
type BuildingStatus = 'qurilmagan' | 'qurilyapti' | 'alo' | 'qulamoqda' | 'shikastlangan' | 'vayrona';
type Phase =
  | 'start'
  | 'idle'
  | 'chapter-intro'
  | 'pitch'
  | 'reaction'
  | 'building'
  | 'celebration'
  | 'blessing'             // citizens emerge with thanks (honest only)
  | 'continue-prompt'      // after 3+ buildings: keep building or jump to time-passes?
  | 'time-passes'
  | 'living-city'
  | 'incident-report'
  | 'collapsing'           // 3D city view, fragile buildings actively collapsing (no UI overlay)
  | 'disaster-cinematic'
  | 'disaster-modal'
  | 'ai-judge'
  | 'game-over';
type DisasterType = 'zilzila' | 'suv-toshqini';

interface BuildingState {
  status: BuildingStatus;
  isFragile: boolean;
}
type BuildingsMap = Record<BuildingId, BuildingState>;

interface ScenarioOption {
  text: string;
  cost: number;
  personalBonus?: number;
  integrityChange: number;
  isCorrupt: boolean;
  reaction: string;
}

interface NPC {
  name: string;
  role: string;
  emoji: string;
  bg: string;
  prop1: string;
  prop2: string;
  patternEmojis: string[];
}

interface Scenario {
  id: number;
  buildingId: BuildingId;
  npc: NPC;
  setting: string;
  pitch: string;
  options: [ScenarioOption, ScenarioOption];
}

type TileType = 'park' | 'tree' | 'house' | 'road-h' | 'road-v' | 'road-cross' | 'plot';
interface Tile {
  type: TileType;
  buildingId?: BuildingId;
  variant?: 1 | 2 | 3;
}

interface HistoryEntry {
  round: number;
  buildingName: string;
  isCorrupt: boolean;
  bonus: number;
}

interface Friend {
  id: string;
  name: string;
  avatar: string;
  integrity: number;
  budget: number;
  tagline: string;
  buildings: BuildingsMap;
}

// ============================================================================
//  STATIC DATA
// ============================================================================

const BUILDING_NAME: Record<BuildingId, string> = {
  maktab: 'Maktab',
  shifoxona: 'Shifoxona',
  bogcha: "Bog'cha",
  masjid: 'Masjid',
  sportzal: 'Sport zal',
};

const BUILDING_EMOJI: Record<BuildingId, string> = {
  maktab: '🏫',
  shifoxona: '🏥',
  bogcha: '🧸',
  masjid: '🕌',
  sportzal: '🏟️',
};

const BUILDING_SUGGESTION: Record<BuildingId, { tagline: string; cost: string; benefit: string }> = {
  maktab: {
    tagline: "500 nafar bola uchun ta'lim maskani",
    cost: '~2 000 – 4 000 tanga',
    benefit: 'Bilim, kelajak, ish o\'rinlari',
  },
  shifoxona: {
    tagline: 'Sog\'liqni saqlash — minglab odamlar uchun',
    cost: '~2 500 – 4 500 tanga',
    benefit: 'Hayotlar saqlanadi, shifo',
  },
  bogcha: {
    tagline: "Eng kichik fuqarolar uchun — onalar tinch",
    cost: '~1 500 – 3 000 tanga',
    benefit: "Bolalar, oilalar, tarbiya",
  },
  masjid: {
    tagline: "Mahalla markazi — ibodat va birlik",
    cost: '~3 000 – 5 000 tanga',
    benefit: "Ma'naviyat, jamoa, birlik",
  },
  sportzal: {
    tagline: "Yoshlar uchun sport va sog'lom turmush",
    cost: '~2 000 – 4 000 tanga',
    benefit: "Sog'liq, sport, yoshlar",
  },
};

const ALL_BUILDING_IDS: BuildingId[] = ['maktab', 'shifoxona', 'bogcha', 'masjid', 'sportzal'];

const BUILD_COMPLETE_VOICE: Record<BuildingId, string> = {
  maktab: "Tabriklaymiz! Maktab qurib bo'ldi.",
  shifoxona: 'Shifoxona ishga tushdi!',
  bogcha: "Bog'cha tayyor!",
  masjid: "Masjid qurilishi tugadi!",
  sportzal: "Sport zal ochildi!",
};

// ── Citizen incident reports — one per corrupt building, shown after living-city ──
interface IncidentReport {
  buildingId: BuildingId;
  citizen: { name: string; role: string; emoji: string; bg: string };
  headline: string;       // big headline that appears
  message: string;        // long detailed report
  voiceLine: string;      // short phrase for speechSynthesis
}

const INCIDENT_REPORTS: Record<BuildingId, IncidentReport> = {
  maktab: {
    buildingId: 'maktab',
    citizen: {
      name: 'Oygul opa',
      role: 'Maktab o\'quvchisining onasi',
      emoji: '👩‍🦰',
      bg: 'from-rose-700 via-rose-900 to-slate-950',
    },
    headline: 'Maktabda devor uvalanib tushdi',
    message:
      "Akangiz, mening qizim Munisa 6-sinfda o'qiydi. Bugun darsda maktabning yuqori qavatidan g'isht uvalanib tushdi. Ikki bola jarohat oldi. Munisa hozir shifoxonada. Aytingchi — nega g'isht shunchalik arzon edi? Kim aybdor?",
    voiceLine: "Mening qizim maktabda jarohatlandi.",
  },
  shifoxona: {
    buildingId: 'shifoxona',
    citizen: {
      name: 'Hasan ota',
      role: 'Bemor qarindoshi',
      emoji: '👨‍🦳',
      bg: 'from-sky-700 via-blue-900 to-slate-950',
    },
    headline: 'Shifoxona uskunasidan noto\'g\'ri tashxis',
    message:
      "Akangiz, mening akam shifoxonada edi. Yangi asbob 3 marta xato natija ko'rsatdi. «Akangizda kasallik yo'q» deyishdi, uyga qaytdi. Bir hafta keyin uyda yiqilib tushdi. Hozir og'ir ahvolda. Asboblar yangi edimi yoki eski?",
    voiceLine: "Akam noto'g'ri tashxis oldi va ahvoli og'ir.",
  },
  bogcha: {
    buildingId: 'bogcha',
    citizen: {
      name: 'Mohira opa',
      role: 'Bog\'cha tarbiyachisi',
      emoji: '👩‍🏫',
      bg: 'from-fuchsia-700 via-purple-900 to-slate-950',
    },
    headline: 'Bog\'cha devori yorildi, bolalar evakuatsiya qilindi',
    message:
      "Akangiz, men 25 yildan beri bog'chada ishlayman. Bunday qo'rqinchli kunni ko'rmaganman. Bugun ertalab bolalar o'ynayotgan edi — devor birdan yorilib ketdi. 4 ta kichkina bola devor yonida edi. Xudo saqladi, jarohatlanmadi. Lekin bog'chani yopdik. Onalar yig'layapti. Agar zilzila kelsa nima bo'ladi?",
    voiceLine: "Bog'cha devorlari yorildi, bolalar qo'rqdi.",
  },
  masjid: {
    buildingId: 'masjid',
    citizen: {
      name: 'Abdulla aka',
      role: 'Mahalla oqsoqoli',
      emoji: '👳',
      bg: 'from-emerald-700 via-teal-900 to-slate-950',
    },
    headline: 'Masjid gumbazi yorildi, namozxonlar evakuatsiya qilindi',
    message:
      "Akangiz, men 40 yildan beri shu mahallada yashayman. Bugun juma namozida masjid gumbazidan g'isht tushdi. Ichkarida 200 ga yaqin odam bor edi. Xudo saqladi \u2014 uch kishi yengil jarohat oldi. Hozir masjidni yopdik. Odamlar qo'rqmoqda. Agar zilzila kelsa nima bo'lar edi?",
    voiceLine: "Masjid gumbazi yorildi, odamlar qo'rqdi.",
  },
  sportzal: {
    buildingId: 'sportzal',
    citizen: {
      name: 'Nodira opa',
      role: 'Sport murabbiyi',
      emoji: '👩\u200d🦱',
      bg: 'from-violet-700 via-purple-900 to-slate-950',
    },
    headline: "Sport zalda trenajyor sinib, o'smirga jarohat yetdi",
    message:
      "Akangiz, men 15 yildan beri bolalarni sportga o'rgataman. Bugun 14 yoshli Bobur jihozda mashq qilayotgan edi \u2014 temir qismi sinib oyog'iga tushdi. Hozir shifoxonada, operatsiya bo'lyapti. Bu jihozlar yangi va sifatli edimi? Nega birdan sinadi?",
    voiceLine: "Trenajyor sinib, o'smir bolaga jarohat yetdi.",
  },
};

const FRESH_BUILDINGS: BuildingsMap = {
  maktab: { status: 'qurilmagan', isFragile: false },
  shifoxona: { status: 'qurilmagan', isFragile: false },
  bogcha: { status: 'qurilmagan', isFragile: false },
  masjid: { status: 'qurilmagan', isFragile: false },
  sportzal: { status: 'qurilmagan', isFragile: false },
};

const NPCS: Record<string, NPC> = {
  karim: {
    name: 'Karim aka', role: 'Quruvchi', emoji: '👷‍♂️',
    bg: 'from-amber-700 via-orange-800 to-amber-950',
    prop1: '🏗️', prop2: '🪜',
    patternEmojis: ['🧱', '🔨', '⚒️', '🪛', '🪚'],
  },
  bahodir: {
    name: 'Bahodir aka', role: 'Tibbiyot uskunalari yetkazib beruvchisi', emoji: '👨‍💼',
    bg: 'from-sky-700 via-blue-800 to-indigo-950',
    prop1: '🏥', prop2: '💊',
    patternEmojis: ['💉', '🩺', '🩹', '⚕️', '🧪'],
  },
  sardor: {
    name: 'Sardor aka', role: 'Bosh quruvchi', emoji: '🧑‍🏭',
    bg: 'from-rose-700 via-red-800 to-rose-950',
    prop1: '🧱', prop2: '🔩',
    patternEmojis: ['🧱', '🔩', '⚙️', '🪨', '🧰'],
  },
  anvar: {
    name: 'Anvar aka', role: 'Arxitektor', emoji: '👨‍🎨',
    bg: 'from-emerald-700 via-teal-800 to-emerald-950',
    prop1: '📐', prop2: '🕌',
    patternEmojis: ['📐', '🧮', '🕌', '⭐', '🌙'],
  },
  dilshod: {
    name: 'Dilshod aka', role: "Sport jihozlari ta'minotchisi", emoji: '🏋️',
    bg: 'from-violet-700 via-purple-800 to-violet-950',
    prop1: '🏀', prop2: '🏋️',
    patternEmojis: ['🏀', '⚽', '🏋️', '🎾', '🏊'],
  },
};

const SCENARIOS: Scenario[] = [
  {
    id: 1, buildingId: 'maktab', npc: NPCS.karim,
    setting: 'Maktab qurilish maydonida...',
    pitch: "Salom akangiz! Maktab uchun ikki xil g'isht bor. Sizga ikkalasini ham aytaman — qaysi birini olamiz?",
    options: [
      {
        text: "Yaxshi, mustahkam g'isht. 4000 tanga ketadi. Maktab 50 yil turadi, bolalar omonda bo'ladi.",
        cost: 4000, integrityChange: 15, isCorrupt: false,
        reaction: "Yaxshi qildingiz akangiz. Bolalar omonda bo'ladi. Pul biroz ko'p ketadi, lekin yaxshi maktab bo'ladi.",
      },
      {
        text: "Arzon g'isht ham bor — 2000 tanga. Qolgan 1500 tangani sizga «minnatdorchilik» qilib beraman. G'ishtning farqini hech kim sezmaydi.",
        cost: 2000, personalBonus: 1500, integrityChange: -30, isCorrupt: true,
        reaction: "Zo'r akangiz! Aqlli odam ekansiz. Pulingiz ertaga ertalab keladi. Ish boshlanaveradi.",
      },
    ],
  },
  {
    id: 2, buildingId: 'shifoxona', npc: NPCS.bahodir,
    setting: 'Ofis qabulxonasida...',
    pitch: "Akangiz, shifoxona uchun yangi asboblar kerak. Men 15 yildan beri shu ishdaman. Bir gap aytay sizga...",
    options: [
      {
        text: "Akangiz, mening do'stimning kompaniyasi bor. Agar siz unga ish bersangiz, men sizga 2000 tanga «rahmat» beraman. Boshqa hech kim bilmaydi.",
        cost: 2500, personalBonus: 2000, integrityChange: -30, isCorrupt: true,
        reaction: "Ko'p rahmat akangiz! Ikkimizga ham foyda bor. Pul bugun yetkaziladi. Asboblar eski, lekin bir necha yil ishlaydi.",
      },
      {
        text: "Ochiq tanlovda eng yaxshi kompaniyani topamiz. 4500 tanga ketadi — asboblar yangi va xavfsiz bo'ladi.",
        cost: 4500, integrityChange: 15, isCorrupt: false,
        reaction: "Tushunarli akangiz. Adolatli ish qilamiz. Yaxshi kompaniya yutsa — fuqarolarga foyda. Hujjatlarni tayyorlayman.",
      },
    ],
  },
  {
    id: 3, buildingId: 'bogcha', npc: NPCS.sardor,
    setting: "Bog'cha qurilish maydonida...",
    pitch: "Akangiz, bog'cha devoriga temir kerak. Bir gap aytay — bu faqat o'rtamizda gap.",
    options: [
      {
        text: "Temirni 2 baravar kamaytirsak ham devor turadi. Bizda zilzila qachondan kelmagan? 1500 tanga ketadi, qolgan 1000 — sizga keladi.",
        cost: 1500, personalBonus: 1000, integrityChange: -30, isCorrupt: true,
        reaction: "Tushunarli akangiz. Tezroq qurib bo'lamiz. Bolalar baribir ichida o'ynashadi — bilmaydilar.",
      },
      {
        text: "To'g'ri qilib quramiz. Temir to'liq bo'lsa, zilzila kelsa ham bog'cha qulamaydi. 3000 tanga ketadi.",
        cost: 3000, integrityChange: 15, isCorrupt: false,
        reaction: "Yaxshi akangiz, to'g'ri qilasiz. Bolalar omonda bo'ladi. Men ham xotirjam ishlayman.",
      },
    ],
  },
  {
    id: 4, buildingId: 'masjid', npc: NPCS.anvar,
    setting: 'Masjid qurilish loyihasi muhokamasi...',
    pitch: "Assalomu alaykum akangiz! Masjid uchun ikki yo'l bor. Diqqat bilan tinglang.",
    options: [
      {
        text: "Mustahkam toshdan poydevor, sifatli gumbaz quramiz. 5000 tanga ketadi, lekin masjid 100 yilga turadi.",
        cost: 5000, integrityChange: 15, isCorrupt: false,
        reaction: "Juda to'g'ri qildingiz akangiz. Bu masjid avlodlarga meros bo'ladi. Halol ish \u2014 barakali.",
      },
      {
        text: "Arzon material ishlatamiz \u2014 tashqaridan farqi bilinmaydi. 2500 tanga, qolgan 1200 \u2014 sizga qaytadi. Hech kim bilmaydi.",
        cost: 2500, personalBonus: 1200, integrityChange: -30, isCorrupt: true,
        reaction: "Tushundim akangiz. Tashqaridan chiroyli ko'rinadi. Faqat... ichkarida nima bor — Alloh biladi.",
      },
    ],
  },
  {
    id: 5, buildingId: 'sportzal', npc: NPCS.dilshod,
    setting: "Sport zal jihozlari tanlash yig'ilishida...",
    pitch: "Salom akangiz! Sport zal uchun jihoz kerak. Ikki taklif bor \u2014 qaysi birini olamiz?",
    options: [
      {
        text: "Sifatli, mustahkam jihozlar olamiz. Bolalar xavfsiz mashq qiladi. 4000 tanga ketadi.",
        cost: 4000, integrityChange: 15, isCorrupt: false,
        reaction: "Yaxshi akangiz. Bolalar xavfsiz mashq qilishadi. Har bir jihoz tekshirilgan.",
      },
      {
        text: "Xitoydan arzon jihozlar olamiz \u2014 tashqaridan yaxshi ko'rinadi. 2000 tanga ketadi, qolgan 1500 \u2014 sizga qaytadi.",
        cost: 2000, personalBonus: 1500, integrityChange: -30, isCorrupt: true,
        reaction: "Kelishildi akangiz! Jihozlar tashqaridan chiroyli ko'rinadi. Faqat... ko'p ishlatilsa sinishi mumkin. Lekin kim biladi?",
      },
    ],
  },
];

const CITY_TILES: Tile[] = [
  { type: 'park' }, { type: 'tree' }, { type: 'house', variant: 1 },
  { type: 'house', variant: 2 }, { type: 'tree' }, { type: 'park' },

  { type: 'tree' }, { type: 'plot', buildingId: 'maktab' }, { type: 'road-h' },
  { type: 'road-h' }, { type: 'plot', buildingId: 'shifoxona' }, { type: 'tree' },

  { type: 'road-h' }, { type: 'road-cross' }, { type: 'road-h' },
  { type: 'road-h' }, { type: 'road-cross' }, { type: 'road-h' },

  { type: 'house', variant: 3 }, { type: 'tree' }, { type: 'road-h' },
  { type: 'road-h' }, { type: 'tree' }, { type: 'house', variant: 1 },

  { type: 'road-h' }, { type: 'road-cross' }, { type: 'road-h' },
  { type: 'road-h' }, { type: 'road-cross' }, { type: 'road-h' },

  { type: 'park' }, { type: 'tree' }, { type: 'plot', buildingId: 'bogcha' },
  { type: 'house', variant: 2 }, { type: 'tree' }, { type: 'park' },
];

const FRIENDS: Friend[] = [
  {
    id: 'sardor', name: 'Sardorbek', avatar: '🦸', integrity: 95, budget: 6500,
    tagline: 'Halol shahar — daraxtlar yashil, bolalar maktabga shod boradi.',
    buildings: {
      maktab: { status: 'alo', isFragile: false },
      shifoxona: { status: 'alo', isFragile: false },
      bogcha: { status: 'alo', isFragile: false },
      masjid: { status: 'alo', isFragile: false },
      sportzal: { status: 'alo', isFragile: false },
    },
  },
  {
    id: 'jasur', name: 'Jasurbek', avatar: '😈', integrity: 12, budget: 8800,
    tagline: "Vayron va qorong'i shahar — onalar yig'laydi.",
    buildings: {
      maktab: { status: 'vayrona', isFragile: false },
      shifoxona: { status: 'vayrona', isFragile: false },
      bogcha: { status: 'vayrona', isFragile: false },
      masjid: { status: 'vayrona', isFragile: false },
      sportzal: { status: 'vayrona', isFragile: false },
    },
  },
  {
    id: 'malika', name: 'Malika', avatar: '🤔', integrity: 58, budget: 4200,
    tagline: "Aralash — ba'zi joylarda yorug'lik bor, ba'zilarida tutun ko'rinadi.",
    buildings: {
      maktab: { status: 'alo', isFragile: false },
      shifoxona: { status: 'alo', isFragile: true },
      bogcha: { status: 'alo', isFragile: true },
      masjid: { status: 'alo', isFragile: true },
      sportzal: { status: 'alo', isFragile: false },
    },
  },
];

// ============================================================================
//  AI JUDGE
// ============================================================================

const MOCK_QUESTIONS: Record<BuildingId, string[]> = {
  maktab: [
    "Bir o'ylang — ertaga shu maktabda sizning ukangiz o'qisa, hozirgi qarordan xotirjam bo'larmidingiz?",
    "Cho'ntakka tushgan pulingiz — 500 ta bolaning xavfsizligidan qimmatmi?",
  ],
  shifoxona: [
    "Tasavvur qiling — bemor sizning onangiz. Eski asbob bilan unga tashxis qo'yilyapti. Bu qaror to'g'rimi?",
    "Bir odamning hayoti qancha turadi? Olgan pulingiz shu hayotdan qimmatmi?",
  ],
  bogcha: [
    "Zilzila kelsa, kuchsiz devor nimaga aylanadi? Ostida qolgan bolalarning aybi bormi?",
    "Sizning ukangiz ertaga shu bog'chaga borsa, bu qarorni hamon to'g'ri deb bilarmidingiz?",
  ],
  masjid: [
    "Masjidda namoz o'qiyotgan odamlar \u2014 sizning ota-onangiz bo'lishi mumkin. Agar gumbaz ular boshiga tushsa?",
    "Alloh oldida javob berasiz \u2014 cho'ntakka olgan pulingiz ibodat uyining xavfsizligidan ustunmi?",
  ],
  sportzal: [
    "Tasavvur qiling \u2014 singan jihoz ostida sizning ukangiz yotibdi. Bu qaror hamon to'g'rimi?",
    "Bir bolaning sog'lig'i \u2014 olgan pulingizdan qimmatmi yoki arzonmi?",
  ],
};

async function askAIJudge(scenario: Scenario): Promise<string[]> {
  try {
    const ctrl = new AbortController();
    const timeout = setTimeout(() => ctrl.abort(), 15000);
    const res = await fetch('/api/judge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        scenario: {
          title: BUILDING_NAME[scenario.buildingId],
          story: scenario.pitch,
          korrupt: {
            label: scenario.options.find((o) => o.isCorrupt)?.text ?? '',
            consequence: scenario.options.find((o) => o.isCorrupt)?.reaction ?? '',
            personalBonus: scenario.options.find((o) => o.isCorrupt)?.personalBonus ?? 0,
          },
        },
      }),
      signal: ctrl.signal,
    });
    clearTimeout(timeout);
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.questions) && data.questions.length > 0) return data.questions;
    }
  } catch { /* fall back to mock */ }
  await new Promise((r) => setTimeout(r, 400));
  return MOCK_QUESTIONS[scenario.buildingId] ?? MOCK_QUESTIONS.maktab;
}

// ============================================================================
//  HELPERS
// ============================================================================

function clamp(x: number, lo = 0, hi = 1) { return Math.max(lo, Math.min(hi, x)); }

function lerpHex(a: string, b: string, t: number) {
  const ah = parseInt(a.slice(1), 16);
  const bh = parseInt(b.slice(1), 16);
  const ar = (ah >> 16) & 0xff, ag = (ah >> 8) & 0xff, ab = ah & 0xff;
  const br = (bh >> 16) & 0xff, bg = (bh >> 8) & 0xff, bb = bh & 0xff;
  const r = Math.round(ar + (br - ar) * t);
  const g = Math.round(ag + (bg - ag) * t);
  const b2 = Math.round(ab + (bb - ab) * t);
  return `#${((r << 16) | (g << 8) | b2).toString(16).padStart(6, '0')}`;
}

function skyColors(integrity: number) {
  const t = clamp(integrity / 100);
  return {
    top: lerpHex('#52525b', '#38bdf8', t),
    mid: lerpHex('#7c5e3a', '#3b82f6', t),
    bot: lerpHex('#1c1917', '#1e3a8a', t),
  };
}

// ============================================================================
//  TYPEWRITER
// ============================================================================

export function TypewriterLine({
  text, delay = 0, speed = 22, onDone, dark = false,
}: {
  text: string; delay?: number; speed?: number; onDone?: () => void; dark?: boolean;
}) {
  const [shown, setShown] = useState('');
  const [done, setDone] = useState(false);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  useEffect(() => {
    setShown(''); setDone(false);
    let i = 0;
    let intervalId: ReturnType<typeof setInterval> | null = null;
    const start = setTimeout(() => {
      intervalId = setInterval(() => {
        i += 1;
        setShown(text.slice(0, i));
        if (i >= text.length) {
          if (intervalId) clearInterval(intervalId);
          intervalId = null;
          setDone(true);
          onDoneRef.current?.();
        }
      }, speed);
    }, delay);
    return () => {
      clearTimeout(start);
      if (intervalId) clearInterval(intervalId);
    };
  }, [text, delay, speed]);

  return (
    <span>
      {shown}
      {!done && (
        <span
          className={`cursor-blink ml-0.5 inline-block h-4 w-[2px] -mb-0.5 ${dark ? 'bg-slate-700' : 'bg-white/70'}`}
        />
      )}
    </span>
  );
}

// ============================================================================
//  HUD (with mute toggle)
// ============================================================================

function CircularRing({ value }: { value: number }) {
  const r = 22;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - clamp(value / 100));
  const color = value >= 70 ? '#34d399' : value >= 40 ? '#facc15' : '#f43f5e';
  return (
    <div className="relative h-14 w-14 shrink-0">
      <svg viewBox="0 0 50 50" className="h-full w-full -rotate-90">
        <circle cx="25" cy="25" r={r} stroke="rgba(255,255,255,0.18)" strokeWidth="5" fill="none" />
        <circle cx="25" cy="25" r={r} stroke={color} strokeWidth="5" strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={offset} fill="none"
          style={{ transition: 'stroke-dashoffset 0.8s, stroke 0.8s' }} />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center text-base font-extrabold">
        {Math.round(value)}
      </div>
    </div>
  );
}

function HUD({
  budget, integrity, round, totalRounds, onVisitFriend, visitingFriend, onBackHome,
  hidden, muted, onToggleMute,
}: {
  budget: number; integrity: number; round: number; totalRounds: number;
  onVisitFriend: () => void; visitingFriend: Friend | null; onBackHome: () => void;
  hidden?: boolean; muted: boolean; onToggleMute: () => void;
}) {
  return (
    <motion.div
      animate={{ opacity: hidden ? 0 : 1, y: hidden ? -20 : 0 }}
      className="pointer-events-none fixed inset-x-0 top-0 z-30 px-3 pt-3 sm:px-6 sm:pt-5"
    >
      <div className="pointer-events-auto mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/15 bg-black/45 px-3 py-2 backdrop-blur-md sm:px-5 sm:py-3">
        <div className="flex items-center gap-3">
          <CircularRing value={integrity} />
          <div className="leading-tight">
            <div className="text-[10px] uppercase tracking-[0.25em] text-yellow-300/80">
              IntegrityCity
            </div>
            <div className="flex items-center gap-1.5 text-sm font-bold text-white">
              <Coins className="h-4 w-4 text-yellow-300" />
              <span className="font-mono tabular-nums">
                {budget.toLocaleString('en-US').replace(/,/g, ' ')}
              </span>
              <span className="text-xs text-yellow-300/80">tanga</span>
            </div>
          </div>
        </div>

        <div className="hidden items-center gap-1 sm:flex">
          {Array.from({ length: totalRounds }).map((_, i) => (
            <span key={i}
              className={`h-2 w-6 rounded-full transition-colors ${
                i < round ? 'bg-yellow-400'
                  : i === round ? 'bg-yellow-400/40 animate-pulse' : 'bg-white/15'
              }`} />
          ))}
          <span className="ml-2 text-xs font-semibold text-white/80">
            {Math.min(round + 1, totalRounds)}/{totalRounds}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onToggleMute}
            title={muted ? 'Ovozni yoqish' : "Ovozni o'chirish"}
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/15 text-white backdrop-blur transition hover:bg-white/25"
          >
            {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
          </button>
          {visitingFriend ? (
            <button onClick={onBackHome}
              className="flex items-center gap-1.5 rounded-xl bg-yellow-400 px-3 py-2 text-xs font-extrabold text-slate-900 shadow-lg transition hover:bg-yellow-300 sm:text-sm">
              <ArrowLeft className="h-4 w-4" /> Mening shahrim
            </button>
          ) : (
            <button onClick={onVisitFriend}
              className="flex items-center gap-1.5 rounded-xl bg-white/15 px-3 py-2 text-xs font-bold text-white backdrop-blur transition hover:bg-white/25 sm:text-sm">
              <Users className="h-4 w-4" /> Do'stim shahri
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
}

// ============================================================================
//  TILE — with construction sequence + richer city life
// ============================================================================

function Tile({
  tile, building, constructionProgress,
}: {
  tile: Tile;
  building?: BuildingState;
  constructionProgress?: number;
}) {
  // ── Decorative tiles with more life ──
  if (tile.type === 'park') {
    return (
      <div className="grass-base relative aspect-square overflow-hidden rounded-md ring-1 ring-emerald-400/20">
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-[26px]">🌳</div>
        <div className="absolute right-0.5 top-0.5 text-xs">🌷</div>
        <div className="absolute left-0.5 top-1 text-[10px]">🪑</div>
        <motion.div className="pointer-events-none absolute bottom-0 left-1 text-sm"
          animate={{ x: [0, 12, 0] }}
          transition={{ repeat: Infinity, duration: 4.5, ease: 'easeInOut' }}>
          🧒
        </motion.div>
      </div>
    );
  }
  if (tile.type === 'tree') {
    return (
      <div className="grass-base relative aspect-square overflow-hidden rounded-md ring-1 ring-emerald-400/20">
        <motion.div className="absolute inset-0 flex items-center justify-center text-[28px] drop-shadow"
          animate={{ y: [0, -2, 0], rotate: [-1, 1, -1] }}
          transition={{ repeat: Infinity, duration: 3 + (tile.variant ?? 1), ease: 'easeInOut' }}>
          🌳
        </motion.div>
        {tile.variant === 1 && (
          <div className="absolute bottom-0 right-0.5 text-[10px]">🍄</div>
        )}
      </div>
    );
  }
  if (tile.type === 'house') {
    const palette = [
      { bg: 'linear-gradient(135deg, #fde68a 0%, #d97706 100%)', extra: '💨' },
      { bg: 'linear-gradient(135deg, #fca5a5 0%, #b91c1c 100%)', extra: '🚗' },
      { bg: 'linear-gradient(135deg, #a7f3d0 0%, #047857 100%)', extra: '🌷' },
    ];
    const v = (tile.variant ?? 1) - 1;
    return (
      <div className="relative aspect-square overflow-hidden rounded-md ring-1 ring-white/15 shadow-[0_2px_4px_rgba(0,0,0,0.3)]"
        style={{ background: palette[v].bg }}>
        <div className="absolute inset-0 flex items-center justify-center text-[28px] drop-shadow">🏠</div>
        {/* Chimney smoke */}
        {v === 0 && (
          <motion.div className="pointer-events-none absolute right-1 top-0 text-xs"
            animate={{ y: [-4, -16], opacity: [0.6, 0] }}
            transition={{ repeat: Infinity, duration: 2.4, ease: 'easeOut' }}>
            💨
          </motion.div>
        )}
        {/* Parked car */}
        {v === 1 && (
          <div className="absolute bottom-0 right-0.5 text-[12px]">🚗</div>
        )}
        {/* Garden + dog */}
        {v === 2 && (
          <>
            <div className="absolute bottom-0 left-0.5 text-[10px]">🌷</div>
            <motion.div className="pointer-events-none absolute bottom-0 right-0 text-xs"
              animate={{ x: [0, -8, 0] }}
              transition={{ repeat: Infinity, duration: 5, ease: 'easeInOut' }}>
              🐕
            </motion.div>
          </>
        )}
      </div>
    );
  }
  if (tile.type === 'road-h' || tile.type === 'road-v' || tile.type === 'road-cross') {
    const cls = tile.type === 'road-cross' ? 'road-h road-v'
      : tile.type === 'road-h' ? 'road-h' : 'road-v';
    return <div className={`road-base relative aspect-square overflow-hidden rounded-sm ${cls}`} />;
  }

  // ── PLOT ──
  const status = building?.status ?? 'qurilmagan';
  const fragile = building?.isFragile ?? false;
  const buildingId = tile.buildingId!;

  // CONSTRUCTION IN PROGRESS — full SimCity-style sequence
  if (status === 'qurilyapti') {
    const p = constructionProgress ?? 0;
    return (
      <motion.div
        className="dirt-base relative aspect-square overflow-hidden rounded-md"
        animate={{ boxShadow: [
          '0 0 0 2px rgba(245,166,35,0.7)',
          '0 0 0 4px rgba(245,166,35,0.3)',
          '0 0 0 2px rgba(245,166,35,0.7)',
        ] }}
        transition={{ repeat: Infinity, duration: 1.4 }}
      >
        {/* Crane swinging */}
        <motion.div
          className="absolute inset-0 flex items-center justify-center text-3xl sm:text-4xl drop-shadow"
          animate={{ rotate: [0, 18, -10, 0] }}
          transition={{ repeat: Infinity, duration: 1.4, ease: 'easeInOut' }}
        >
          🏗️
        </motion.div>

        {/* Worker walking */}
        <motion.div
          className="absolute bottom-0.5 left-0.5 text-sm"
          animate={{ x: [0, 24, 0] }}
          transition={{ repeat: Infinity, duration: 2.6, ease: 'easeInOut' }}
        >
          👷
        </motion.div>

        {/* Dust puffs */}
        <motion.div
          className="pointer-events-none absolute right-1 top-0 text-xs"
          animate={{ y: [0, -10, -18], opacity: [0.8, 0.4, 0] }}
          transition={{ repeat: Infinity, duration: 1.4, ease: 'easeOut' }}
        >
          💨
        </motion.div>
        <motion.div
          className="pointer-events-none absolute left-1 top-1 text-[10px]"
          animate={{ y: [0, -8, -14], opacity: [0.7, 0.3, 0] }}
          transition={{ repeat: Infinity, duration: 1.6, delay: 0.6, ease: 'easeOut' }}
        >
          💨
        </motion.div>

        {/* Construction sparks (intermittent) */}
        <motion.div
          className="pointer-events-none absolute inset-0 flex items-end justify-center pb-3 text-xs"
          animate={{ opacity: [0, 1, 0], scale: [0.6, 1.1, 0.8] }}
          transition={{ repeat: Infinity, duration: 0.8, ease: 'easeInOut' }}
        >
          ✨
        </motion.div>

        {/* Progress bar at bottom */}
        <div className="absolute inset-x-0 bottom-0 h-1.5 bg-black/55">
          <div
            className="h-full bg-gradient-to-r from-yellow-300 via-amber-400 to-orange-500 shadow"
            style={{ width: `${p * 100}%`, transition: 'width 0.1s linear' }}
          />
        </div>

        {/* Percentage badge */}
        <div className="absolute -top-1 left-1/2 -translate-x-1/2 rounded-b-md bg-yellow-400 px-1.5 py-0.5 text-[9px] font-extrabold text-slate-900 shadow">
          {Math.round(p * 100)}%
        </div>
      </motion.div>
    );
  }

  // OTHER STATES (qurilmagan, alo, shikastlangan, vayrona)
  const emoji = status === 'qurilmagan' ? '🚧' : status === 'vayrona' ? '💥' : BUILDING_EMOJI[buildingId];

  let baseClass = 'dirt-base';
  let auraClass = '';
  let extraEffect: React.ReactNode = null;

  if (status === 'alo') {
    baseClass = fragile ? 'dirt-base' : 'grass-base';
    auraClass = fragile ? 'aura-corrupt' : 'aura-sparkle';
    if (fragile) {
      extraEffect = (
        <>
          <div className="pointer-events-none absolute left-1/2 top-1 -translate-x-1/2 text-lg smoke">💨</div>
          <div className="pointer-events-none absolute left-1/2 top-1 -translate-x-1/2 text-base smoke-2">💨</div>
        </>
      );
    } else {
      extraEffect = (
        <>
          <div className="pointer-events-none absolute left-1 bottom-1 text-xs float-up">✨</div>
          <div className="pointer-events-none absolute right-1 bottom-1 text-xs float-up-2">✨</div>
        </>
      );
    }
  } else if (status === 'shikastlangan') {
    baseClass = 'dirt-base';
    auraClass = 'ring-2 ring-amber-400/50';
    extraEffect = <div className="pointer-events-none absolute right-1 top-1 text-base">⚠️</div>;
  } else if (status === 'vayrona') {
    baseClass = 'road-base';
    auraClass = 'aura-rubble';
  }

  return (
    <motion.div
      layout
      className={`relative aspect-square overflow-hidden rounded-md ${baseClass} ${auraClass}`}
      initial={false}
      animate={status === 'vayrona'
        ? { rotate: [-2, 2, -2, 0], scale: 0.9 }
        : { rotate: 0, scale: 1 }}
      transition={{ duration: 0.5 }}
    >
      <motion.div
        key={status}
        initial={status === 'alo' ? { scale: 0, y: 24 } : false}
        animate={{ scale: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 320, damping: 15 }}
        className="absolute inset-0 flex items-center justify-center text-3xl drop-shadow sm:text-4xl"
      >
        {emoji}
      </motion.div>
      {extraEffect}
    </motion.div>
  );
}

// ============================================================================
//  CITY MAP — with traffic/clouds + construction passthrough
// ============================================================================

function CityMap({
  buildings, shakeKey, dimmed, constructingId, constructionProgress,
}: {
  buildings: BuildingsMap;
  shakeKey: number;
  dimmed?: boolean;
  constructingId?: BuildingId | null;
  constructionProgress?: number;
}) {
  const motionProps = shakeKey
    ? { animate: { x: [0, -10, 12, -8, 8, -4, 0], y: [0, 4, -4, 6, -2, 2, 0] } }
    : { animate: { x: 0, y: 0 } };

  return (
    <motion.div
      className="relative"
      animate={{ filter: dimmed ? 'blur(4px) brightness(0.6)' : 'blur(0px) brightness(1)' }}
      transition={{ duration: 0.4 }}
    >
      <motion.div className="pointer-events-none absolute -top-6 left-0 z-20 text-3xl"
        animate={{ x: ['-10%', '110%'] }}
        transition={{ repeat: Infinity, duration: 24, ease: 'linear' }}>☁️</motion.div>
      <motion.div className="pointer-events-none absolute -top-2 left-0 z-20 text-2xl"
        animate={{ x: ['-15%', '115%'] }}
        transition={{ repeat: Infinity, duration: 36, ease: 'linear', delay: 8 }}>☁️</motion.div>
      <motion.div className="pointer-events-none absolute left-0 top-[44%] z-20 -translate-y-1/2 text-2xl"
        animate={{ x: ['-5%', '105%'] }}
        transition={{ repeat: Infinity, duration: 12, ease: 'linear' }}>🚗</motion.div>
      <motion.div className="pointer-events-none absolute left-0 top-[71%] z-20 -translate-y-1/2 text-2xl"
        animate={{ x: ['105%', '-5%'] }}
        transition={{ repeat: Infinity, duration: 16, ease: 'linear', delay: 4 }}>🚌</motion.div>

      <motion.div
        key={`shake-${shakeKey}`}
        {...motionProps}
        transition={{ duration: 0.7 }}
        className="mx-auto grid w-full max-w-3xl grid-cols-6 gap-1.5 rounded-3xl border border-white/15 bg-black/25 p-3 shadow-2xl backdrop-blur-sm sm:gap-2 sm:p-4"
      >
        {CITY_TILES.map((tile, i) => (
          <Tile
            key={i}
            tile={tile}
            building={tile.buildingId ? buildings[tile.buildingId] : undefined}
            constructionProgress={
              tile.buildingId === constructingId ? constructionProgress : undefined
            }
          />
        ))}
      </motion.div>
    </motion.div>
  );
}

// ============================================================================
//  CHAPTER INTRO
// ============================================================================

function ChapterIntro({ scenario, onDone }: { scenario: Scenario; onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 2400);
    return () => clearTimeout(t);
  }, [onDone]);

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/95"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
    >
      <motion.div
        className="absolute inset-0 opacity-20"
        animate={{ backgroundPositionX: ['0%', '100%'] }}
        transition={{ repeat: Infinity, duration: 10, ease: 'linear' }}
        style={{
          backgroundImage:
            'repeating-linear-gradient(45deg, rgba(245,166,35,0.2) 0 12px, transparent 12px 32px)',
        }}
      />
      <motion.div
        initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -20, opacity: 0 }}
        transition={{ duration: 0.5 }}
        className="relative z-10 text-center"
      >
        <motion.div
          className="text-yellow-300 text-xs sm:text-sm uppercase font-bold"
          style={{ letterSpacing: '0.5em' }}
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ repeat: Infinity, duration: 2 }}
        >
          BOSQICH {scenario.id} / {SCENARIOS.length}
        </motion.div>
        <motion.div
          initial={{ scale: 1.2, letterSpacing: '0.2em' }}
          animate={{ scale: 1, letterSpacing: '0em' }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="mt-3 text-5xl font-black text-white sm:text-7xl"
        >
          {BUILDING_NAME[scenario.buildingId].toUpperCase()}
        </motion.div>
        <motion.div
          initial={{ scale: 0, rotate: -180 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ delay: 0.6, type: 'spring' }}
          className="mt-2 text-7xl sm:text-8xl"
        >
          {BUILDING_EMOJI[scenario.buildingId]}
        </motion.div>
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          transition={{ delay: 1, duration: 0.6 }}
          className="mt-4 text-base italic text-white/70 sm:text-lg"
        >
          {scenario.setting}
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.4, duration: 0.5 }}
          className="mt-6 inline-flex items-center gap-2 rounded-full bg-yellow-400/15 px-4 py-2"
        >
          <span className="text-3xl">{scenario.npc.emoji}</span>
          <span className="text-sm font-bold text-yellow-200">
            {scenario.npc.name} sizga gap aytmoqchi...
          </span>
        </motion.div>
      </motion.div>
    </motion.div>
  );
}

// ============================================================================
//  COIN BURST
// ============================================================================

function CoinBurst({ trigger }: { trigger: number }) {
  if (!trigger) return null;
  const N = 14;
  return (
    <div key={trigger} className="pointer-events-none fixed inset-0 z-50">
      {Array.from({ length: N }).map((_, i) => {
        const angle = (i / N) * Math.PI * 2 + Math.random() * 0.3;
        const dist = 180 + Math.random() * 160;
        return (
          <motion.div
            key={i}
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-3xl drop-shadow-lg"
            initial={{ x: 0, y: 0, opacity: 0, scale: 0.4, rotate: 0 }}
            animate={{
              x: Math.cos(angle) * dist,
              y: Math.sin(angle) * dist - 60,
              opacity: [0, 1, 1, 0],
              scale: [0.4, 1.2, 1, 0.6],
              rotate: 720,
            }}
            transition={{ duration: 1.4, ease: 'easeOut' }}
          >
            🪙
          </motion.div>
        );
      })}
      <motion.div
        className="absolute inset-0"
        initial={{ opacity: 0 }} animate={{ opacity: [0, 0.5, 0] }}
        transition={{ duration: 0.6 }}
        style={{ background: 'radial-gradient(circle, rgba(245,166,35,0.4) 0%, transparent 60%)' }}
      />
    </div>
  );
}

// ============================================================================
//  PITCH SCENE — full-screen visual novel
// ============================================================================

function NPCPattern({ npc }: { npc: NPC }) {
  const items = useMemo(() => {
    const arr: { e: string; top: string; left: string; size: number; dur: number; delay: number }[] = [];
    for (let i = 0; i < 14; i++) {
      arr.push({
        e: npc.patternEmojis[i % npc.patternEmojis.length],
        top: `${Math.random() * 90}%`,
        left: `${Math.random() * 95}%`,
        size: 24 + Math.floor(Math.random() * 36),
        dur: 6 + Math.random() * 10,
        delay: Math.random() * 5,
      });
    }
    return arr;
  }, [npc]);
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {items.map((it, i) => (
        <motion.div
          key={i}
          className="absolute opacity-[0.07]"
          style={{ top: it.top, left: it.left, fontSize: it.size }}
          animate={{ y: [0, -12, 0], rotate: [0, 6, -6, 0] }}
          transition={{ repeat: Infinity, duration: it.dur, delay: it.delay, ease: 'easeInOut' }}
        >
          {it.e}
        </motion.div>
      ))}
    </div>
  );
}

function CharacterPortrait({ npc, speaking }: { npc: NPC; speaking: boolean }) {
  return (
    <motion.div
      className="relative shrink-0"
      animate={speaking ? { y: [0, -3, 0] } : { y: 0 }}
      transition={{ repeat: speaking ? Infinity : 0, duration: 1.6, ease: 'easeInOut' }}
    >
      <div className="relative h-52 w-52 overflow-hidden rounded-full border-[6px] border-yellow-400/70 shadow-2xl sm:h-72 sm:w-72">
        <div className={`absolute inset-0 bg-gradient-to-br ${npc.bg}`} />
        <div className="absolute inset-0 opacity-15">
          <div className="absolute right-3 top-3 text-5xl">{npc.prop1}</div>
          <div className="absolute bottom-3 left-3 text-5xl">{npc.prop2}</div>
        </div>
        <motion.div
          className="absolute inset-0 flex items-center justify-center"
          animate={speaking ? { rotate: [-2, 2, -2], y: [0, -3, 0] } : { rotate: 0, y: 0 }}
          transition={{ repeat: speaking ? Infinity : 0, duration: 0.55 }}
        >
          <span className="text-[7rem] leading-none drop-shadow-2xl sm:text-[9rem]">
            {npc.emoji}
          </span>
        </motion.div>
        <div className="absolute inset-0 ring-1 ring-inset ring-white/10" />
      </div>
      <motion.div
        initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="absolute -bottom-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-2xl border-2 border-yellow-400 bg-slate-950/95 px-4 py-2 text-center shadow-xl"
      >
        <div className="text-base font-extrabold text-white">{npc.name}</div>
        <div className="text-[10px] uppercase tracking-[0.2em] text-yellow-300">{npc.role}</div>
      </motion.div>
    </motion.div>
  );
}

function SpeechBubble({
  text, speed = 22, onDone,
}: { text: string; speed?: number; onDone?: () => void }) {
  return (
    <div className="relative">
      <div className="rounded-3xl bg-white px-5 py-4 text-[15px] leading-relaxed text-slate-900 shadow-2xl sm:px-7 sm:py-6 sm:text-lg">
        <TypewriterLine text={text} speed={speed} onDone={onDone} dark />
      </div>
      <div className="absolute -left-3 top-12 hidden h-0 w-0 border-y-[14px] border-r-[18px] border-y-transparent border-r-white sm:block" />
    </div>
  );
}

function PitchScene({
  scenario, step, chosenIdx, onChoose, onContinue,
}: {
  scenario: Scenario;
  step: 'pitch' | 'reaction';
  chosenIdx: number | null;
  onChoose: (i: number) => void;
  onContinue: () => void;
}) {
  const [textDone, setTextDone] = useState(false);
  useEffect(() => { setTextDone(false); }, [scenario.id, step]);

  const text = step === 'pitch'
    ? scenario.pitch
    : (chosenIdx !== null ? scenario.options[chosenIdx].reaction : '');
  const chose = chosenIdx !== null ? scenario.options[chosenIdx] : null;

  return (
    <motion.div
      key={`pitch-${scenario.id}-${step}`}
      className="fixed inset-0 z-30"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      transition={{ duration: 0.4 }}
    >
      <div className={`absolute inset-0 bg-gradient-to-br ${scenario.npc.bg}`} />
      <div className="absolute inset-0 opacity-50"
        style={{
          background:
            'radial-gradient(circle at 20% 20%, rgba(255,255,255,0.12), transparent 60%), radial-gradient(circle at 80% 70%, rgba(0,0,0,0.4), transparent 60%)',
        }} />
      <NPCPattern npc={scenario.npc} />

      <div className="relative flex min-h-full items-end px-3 pb-4 pt-24 sm:items-center sm:px-8 sm:pb-8">
        <div className="mx-auto grid w-full max-w-6xl items-center gap-8 sm:grid-cols-[auto_1fr] sm:gap-12">
          <div className="flex justify-center sm:justify-start">
            <CharacterPortrait npc={scenario.npc} speaking={!textDone} />
          </div>

          <div className="min-w-0">
            <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-black/35 px-3 py-1 text-[10px] uppercase tracking-[0.25em] text-yellow-300/90 backdrop-blur">
              <span>Bosqich {scenario.id}/{SCENARIOS.length}</span>
              <span className="text-white/50">·</span>
              <span>{BUILDING_NAME[scenario.buildingId]}</span>
              <span className="text-base">{BUILDING_EMOJI[scenario.buildingId]}</span>
            </div>

            <SpeechBubble
              key={`${scenario.id}-${step}`}
              text={text}
              speed={step === 'reaction' ? 20 : 18}
              onDone={() => setTextDone(true)}
            />

            {step === 'pitch' ? (
              <div className="mt-5 grid gap-2.5">
                {scenario.options.map((opt, i) => (
                  <motion.button
                    key={i}
                    initial={{ x: 20, opacity: 0 }}
                    animate={{ x: 0, opacity: textDone ? 1 : 0.4 }}
                    transition={{ delay: 0.1 + i * 0.1, duration: 0.4 }}
                    whileHover={textDone ? { x: 6, scale: 1.01 } : undefined}
                    whileTap={textDone ? { scale: 0.98 } : undefined}
                    disabled={!textDone}
                    onClick={() => { audio.click(); onChoose(i); }}
                    className="group flex items-start gap-3 rounded-2xl border-2 border-white/15 bg-white/[0.06] p-4 text-left backdrop-blur-sm transition hover:border-yellow-400/60 hover:bg-yellow-400/10 disabled:cursor-not-allowed disabled:opacity-50 sm:gap-4 sm:p-5"
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-yellow-400 text-lg font-black text-slate-900 shadow-lg transition group-hover:scale-110 sm:h-12 sm:w-12 sm:text-xl">
                      {String.fromCharCode(65 + i)}
                    </div>
                    <div className="flex-1 text-[14px] leading-relaxed text-white sm:text-[16px]">
                      {opt.text}
                    </div>
                    <ChevronRight className="mt-2 h-5 w-5 shrink-0 text-yellow-300/60 transition group-hover:translate-x-1" />
                  </motion.button>
                ))}
              </div>
            ) : (
              <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
                {chose?.personalBonus ? (
                  <motion.div
                    initial={{ scale: 0.7, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: 0.4, type: 'spring', stiffness: 200 }}
                    className="flex items-center gap-2 rounded-2xl bg-yellow-400/20 px-4 py-2 text-sm font-extrabold text-yellow-200 ring-2 ring-yellow-400/40"
                  >
                    <span className="text-xl">🪙</span>
                    Cho'ntakka +{chose.personalBonus.toLocaleString('en-US').replace(/,/g, ' ')} tanga
                  </motion.div>
                ) : (
                  <motion.div
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                    transition={{ delay: 0.4 }}
                    className="text-xs text-white/65"
                  >
                    Byudjet: −{chose?.cost.toLocaleString('en-US').replace(/,/g, ' ')} tanga
                  </motion.div>
                )}
                <motion.button
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: textDone ? 1 : 0.4, x: 0 }}
                  transition={{ delay: 0.6 }}
                  whileHover={textDone ? { scale: 1.05, y: -2 } : undefined}
                  whileTap={textDone ? { scale: 0.97 } : undefined}
                  onClick={() => { audio.click(); onContinue(); }}
                  disabled={!textDone}
                  className="rounded-2xl bg-yellow-400 px-6 py-3 text-base font-black text-slate-900 shadow-2xl transition hover:bg-yellow-300 disabled:opacity-40"
                >
                  Qurilishga o'tish <ChevronRight className="ml-0.5 inline h-5 w-5" />
                </motion.button>
              </div>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}



// ============================================================================
//  CONSTRUCTION OVERLAY — banner during building phase
// ============================================================================

function BuildButton({
  buildingId, buildStage, onTap,
}: {
  buildingId: BuildingId; buildStage: number; onTap: () => void;
}) {
  const stageLabels = [
    "Poydevor qo'ying",
    "Devorlarni qo'ying",
    "Tomni yoping",
    'Tayyor!',
  ];
  const stageEmojis = ['🪨', '🧱', '🏠', '🎉'];
  const isDone = buildStage >= 3;

  return (
    <>
      {/* Top banner: title + stage indicator */}
      <motion.div
        className="pointer-events-none fixed inset-x-0 top-24 z-20 flex justify-center px-3"
        initial={{ y: -30, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: -30, opacity: 0 }}
      >
        <div className="flex items-center gap-3 rounded-2xl border-2 border-yellow-400/50 bg-slate-950/90 px-4 py-2 shadow-2xl backdrop-blur sm:px-5 sm:py-2.5">
          <motion.div
            animate={!isDone ? { rotate: [0, 18, -10, 0] } : { rotate: 0 }}
            transition={{ repeat: !isDone ? Infinity : 0, duration: 1.4 }}
            className="text-3xl sm:text-4xl"
          >
            🏗️
          </motion.div>
          <div className="min-w-[140px]">
            <div className="text-[10px] font-bold uppercase tracking-[0.25em] text-yellow-300">
              Qurilish · {Math.min(buildStage, 3)}/3
            </div>
            <div className="text-sm font-extrabold text-white sm:text-base">
              {BUILDING_NAME[buildingId]} {BUILDING_EMOJI[buildingId]}
            </div>
          </div>
          {/* Stage dots */}
          <div className="flex gap-1.5">
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className={`h-2.5 w-2.5 rounded-full transition-colors ${
                  i < buildStage ? 'bg-yellow-400' : 'bg-white/20'
                }`}
              />
            ))}
          </div>
        </div>
      </motion.div>

      {/* Bottom interactive QURISH button */}
      <motion.div
        className="pointer-events-auto fixed inset-x-0 bottom-0 z-30 flex flex-col items-center px-4 pb-5 sm:pb-8"
        initial={{ y: 120, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 120, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 240, damping: 22 }}
      >
        <div className="w-full max-w-md rounded-3xl border-2 border-yellow-400/40 bg-slate-950/90 p-4 shadow-2xl backdrop-blur">
          <div className="mb-3 text-center">
            <div className="text-[10px] font-bold uppercase tracking-[0.3em] text-yellow-300">
              Sizning navbatingiz
            </div>
            <div className="mt-0.5 flex items-center justify-center gap-2 text-base font-extrabold text-white sm:text-lg">
              <span className="text-2xl">{stageEmojis[Math.min(buildStage, 3)]}</span>
              {stageLabels[Math.min(buildStage, 3)]}
            </div>
          </div>

          <motion.button
            whileHover={!isDone ? { scale: 1.04, y: -3 } : undefined}
            whileTap={!isDone ? { scale: 0.93, y: 6 } : undefined}
            animate={!isDone ? {
              boxShadow: [
                '0 0 0 0 rgba(245,166,35,0.65)',
                '0 0 0 18px rgba(245,166,35,0)',
                '0 0 0 0 rgba(245,166,35,0.65)',
              ],
            } : { boxShadow: '0 0 0 0 rgba(0,0,0,0)' }}
            transition={{ repeat: !isDone ? Infinity : 0, duration: 1.6 }}
            onClick={!isDone ? onTap : undefined}
            disabled={isDone}
            className="flex w-full items-center justify-center gap-3 rounded-2xl bg-gradient-to-br from-yellow-300 via-yellow-400 to-amber-500 px-6 py-5 text-xl font-black uppercase tracking-wider text-slate-900 shadow-2xl transition disabled:opacity-50 disabled:cursor-not-allowed sm:text-2xl"
          >
            <Hammer className="h-7 w-7" />
            {isDone ? 'Tayyor!' : 'QURISH!'}
            {!isDone && <span className="text-2xl">🔨</span>}
          </motion.button>

          <div className="mt-2 text-center text-[11px] text-white/60">
            {isDone
              ? "Bino tayyor — bir soniyada davom etamiz"
              : `Tugmani bosing! Yana ${3 - buildStage} marta bosish kerak`}
          </div>
        </div>
      </motion.div>
    </>
  );
}

// ============================================================================
//  CITIZEN BLESSINGS — fuqarolar binodan chiqib rahmat aytadi (faqat halol)
// ============================================================================

interface BlessingData {
  emojis: string[];        // 3-4 ta avatar emoji
  text: string;
  voiceLine: string;
  bonus: number;           // bonus tanga
}

const BLESSINGS: Record<BuildingId, BlessingData> = {
  maktab: {
    emojis: ['👨‍🏫', '👧', '👦', '👨‍👩‍👧'],
    text: "500 ta bola va ularning ota-onalari sizga rahmat aytmoqda. Yaxshi maktab qurganingiz uchun raxmat!",
    voiceLine: "Rahmat sizga! Bolalarimiz xavfsiz o'qiydi.",
    bonus: 800,
  },
  shifoxona: {
    emojis: ['👩‍⚕️', '👨‍⚕️', '🤰', '👴'],
    text: "Shifokorlar va bemorlar sizga rahmat aytmoqda. Yangi asboblar bilan ko'p odamning hayoti saqlanadi!",
    voiceLine: "Sizga sog'lik tilaymiz! Hayotimiz saqlandi.",
    bonus: 900,
  },
  bogcha: {
    emojis: ['👶', '👩', '👨‍👩‍👧', '🧸'],
    text: "Kichkina bolalar va ularning onalari sizdan minnatdor. Mustahkam bog'cha qurganingiz uchun rahmat!",
    voiceLine: "Bolalar omonda. Sizga uzoq umr!",
    bonus: 750,
  },
  masjid: {
    emojis: ['👳', '🧕', '👨‍👩‍👧‍👦', '🤲'],
    text: "Mahalla aholisi sizga duo qilmoqda. Bu masjid avlodlarga meros bo'ladi!",
    voiceLine: "Alloh sizdan rozi bo'lsin! Masjid mustahkam.",
    bonus: 850,
  },
  sportzal: {
    emojis: ['🏃', '⚽', '🤸', '👦'],
    text: "Yoshlar va sportchilar sizga rahmat. Sog'lom bolalar — kuchli kelajak!",
    voiceLine: "Rahmat! Bolalar xavfsiz sport qilmoqda.",
    bonus: 800,
  },
};

function CitizenBlessing({
  buildingId, onComplete,
}: {
  buildingId: BuildingId;
  onComplete: () => void;
}) {
  const data = BLESSINGS[buildingId];

  useEffect(() => {
    audio.victory();
    setTimeout(() => audio.speak(data.voiceLine, { rate: 1, pitch: 1.05 }), 500);
    const t = setTimeout(onComplete, 4500);
    return () => clearTimeout(t);
  }, [onComplete, data.voiceLine]);

  return (
    <motion.div
      className="pointer-events-none fixed inset-x-0 top-24 z-30 flex justify-center px-3"
      initial={{ y: -50, opacity: 0, scale: 0.7 }}
      animate={{ y: 0, opacity: 1, scale: 1 }}
      exit={{ y: -50, opacity: 0 }}
      transition={{ type: 'spring', stiffness: 220, damping: 18 }}
    >
      <div className="relative max-w-2xl rounded-3xl border-2 border-emerald-400/60 bg-gradient-to-br from-emerald-700 to-emerald-950 p-5 shadow-2xl backdrop-blur">
        {/* Sparkle background */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-3xl">
          {[...Array(8)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute text-2xl"
              initial={{
                x: `${20 + i * 10}%`,
                y: '110%',
                opacity: 0.8,
              }}
              animate={{ y: '-20%', opacity: 0 }}
              transition={{
                duration: 2 + Math.random() * 1.5,
                delay: i * 0.2,
                repeat: Infinity,
              }}
            >
              ✨
            </motion.div>
          ))}
        </div>

        <div className="relative">
          <div className="mb-2 flex items-center justify-between">
            <div className="flex items-center gap-2 rounded-full bg-yellow-400/30 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.25em] text-yellow-100">
              📣 Fuqarolar barakasi
            </div>
            <div className="flex items-center gap-1 rounded-full bg-yellow-400 px-3 py-1 text-sm font-extrabold text-slate-900">
              <span className="text-base">🪙</span> +{data.bonus} bonus
            </div>
          </div>

          {/* Citizen avatars emerging */}
          <div className="mb-3 flex justify-center gap-2">
            {data.emojis.map((emoji, i) => (
              <motion.div
                key={i}
                initial={{ y: 60, opacity: 0, scale: 0 }}
                animate={{ y: 0, opacity: 1, scale: 1 }}
                transition={{
                  delay: i * 0.18,
                  type: 'spring',
                  stiffness: 250,
                  damping: 14,
                }}
                className="text-5xl drop-shadow-2xl sm:text-6xl"
              >
                {emoji}
              </motion.div>
            ))}
          </div>

          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="text-center text-base leading-relaxed text-white sm:text-lg"
          >
            {data.text}
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
}

function BonusCoinBurst({ trigger }: { trigger: number }) {
  if (!trigger) return null;
  const N = 18;
  return (
    <div key={`bonus-${trigger}`} className="pointer-events-none fixed inset-0 z-40">
      {Array.from({ length: N }).map((_, i) => {
        const angle = (i / N) * Math.PI * 2 + Math.random() * 0.4;
        const dist = 220 + Math.random() * 200;
        return (
          <motion.div
            key={i}
            className="absolute left-1/2 top-1/3 -translate-x-1/2 text-3xl drop-shadow-lg"
            initial={{ x: 0, y: 0, opacity: 0, scale: 0.4 }}
            animate={{
              x: Math.cos(angle) * dist,
              y: Math.sin(angle) * dist - 40,
              opacity: [0, 1, 1, 0],
              scale: [0.4, 1.3, 1, 0.5],
              rotate: 720,
            }}
            transition={{ duration: 1.8, ease: 'easeOut' }}
          >
            🪙
          </motion.div>
        );
      })}
    </div>
  );
}

// ============================================================================
//  CONTINUE PROMPT — after 3+ buildings, ask to continue or skip to time
// ============================================================================

function ContinuePrompt({
  builtCount, total, onContinue, onStop,
}: {
  builtCount: number;
  total: number;
  onContinue: () => void;
  onStop: () => void;
}) {
  return (
    <motion.div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/75 p-4 backdrop-blur-md"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
    >
      <motion.div
        initial={{ scale: 0.7, y: 30 }} animate={{ scale: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 220, damping: 18 }}
        className="w-full max-w-xl overflow-hidden rounded-3xl border-2 border-yellow-400/60 bg-gradient-to-br from-slate-900 to-slate-950 p-6 shadow-2xl"
      >
        <div className="mb-3 flex items-center gap-3">
          <div className="text-5xl">🏗️</div>
          <div>
            <div className="text-[10px] uppercase tracking-[0.3em] text-yellow-300">
              {builtCount}/{total} qurildi
            </div>
            <div className="text-2xl font-black text-white">
              Yana qurmoqchimisiz?
            </div>
          </div>
        </div>

        <p className="text-base leading-relaxed text-white/85">
          Sizda {builtCount} ta bino bor. Yana {total - builtCount} ta bo'sh joy. Yana qurasizmi yoki yillar o'tishini ko'rasizmi?
        </p>

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <motion.button
            whileHover={{ scale: 1.03, y: -2 }} whileTap={{ scale: 0.97 }}
            onClick={onContinue}
            className="rounded-2xl bg-yellow-400 px-5 py-4 text-base font-extrabold text-slate-900 shadow-lg transition hover:bg-yellow-300"
          >
            ➕ Yana quraman
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.03, y: -2 }} whileTap={{ scale: 0.97 }}
            onClick={onStop}
            className="rounded-2xl bg-white/10 px-5 py-4 text-base font-extrabold text-white shadow-lg transition hover:bg-white/20 border-2 border-white/20"
          >
            ⏳ Bas, yillar o'tsin
          </motion.button>
        </div>

        <div className="mt-3 text-center text-[11px] text-white/55">
          Yillar o'tsa — qaroringiz qanday natija berganini ko'rasiz
        </div>
      </motion.div>
    </motion.div>
  );
}

function CompletionBanner({ buildingId, isCorrupt }: {
  buildingId: BuildingId; isCorrupt: boolean;
}) {
  return (
    <motion.div
      className="pointer-events-none fixed inset-x-0 top-24 z-20 flex justify-center px-3"
      initial={{ scale: 0.7, y: -30, opacity: 0 }}
      animate={{ scale: 1, y: 0, opacity: 1 }}
      exit={{ scale: 0.9, opacity: 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 20 }}
    >
      <div className="flex items-center gap-3 rounded-2xl border-2 border-emerald-400/60 bg-emerald-950/95 px-5 py-3 shadow-2xl backdrop-blur">
        <motion.div
          animate={{ scale: [1, 1.2, 1], rotate: [0, -6, 6, 0] }}
          transition={{ repeat: Infinity, duration: 1.5 }}
          className="text-4xl sm:text-5xl"
        >
          {BUILDING_EMOJI[buildingId]}
        </motion.div>
        <div>
          <div className="text-[10px] font-bold uppercase tracking-[0.25em] text-emerald-300">
            ✓ Bino tayyor
          </div>
          <div className="text-base font-extrabold text-white sm:text-lg">
            {BUILDING_NAME[buildingId]} qurib bo'ldi!
          </div>
          <div className="text-xs text-white/70">
            {isCorrupt ? "Tashqaridan chiroyli ko'rinadi..." : 'Mustahkam va ishonchli.'}
          </div>
        </div>
        <div className="text-3xl">✨</div>
      </div>
    </motion.div>
  );
}

// ============================================================================
//  DISASTER CINEMATIC + MODAL
// ============================================================================

function DisasterCinematic({ type, onDone }: { type: DisasterType; onDone: () => void }) {
  useEffect(() => {
    audio.disaster();
    audio.speak(type === 'zilzila' ? 'Diqqat! Zilzila!' : 'Diqqat! Suv toshqini!', {
      rate: 1.1, pitch: 0.95,
    });
    const t = setTimeout(onDone, 2200);
    return () => clearTimeout(t);
  }, [onDone, type]);

  const debrisEmojis = type === 'zilzila' ? ['💥', '🪨', '⚡', '🔥'] : ['🌊', '💧', '🪵', '☔'];
  const N = 26;

  return (
    <motion.div
      className="pointer-events-none fixed inset-0 z-50 overflow-hidden"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
    >
      <motion.div
        className="absolute inset-0"
        animate={{
          backgroundColor: ['rgba(127,29,29,0)', 'rgba(127,29,29,0.5)', 'rgba(127,29,29,0.3)', 'rgba(127,29,29,0.6)'],
        }}
        transition={{ duration: 2 }}
      />
      <motion.div
        className="absolute inset-0 bg-white"
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 0.8, 0, 0.6, 0, 0.4, 0] }}
        transition={{ duration: 1.6 }}
      />
      {Array.from({ length: N }).map((_, i) => (
        <motion.div
          key={i}
          className="absolute text-3xl sm:text-4xl"
          initial={{ x: `${Math.random() * 100}%`, y: -80, rotate: 0 }}
          animate={{ y: '110vh', rotate: 540 + Math.random() * 360 }}
          transition={{
            duration: 1.4 + Math.random() * 1.2,
            delay: Math.random() * 0.8,
            ease: 'easeIn',
          }}
        >
          {debrisEmojis[i % debrisEmojis.length]}
        </motion.div>
      ))}
      <div className="absolute inset-0 flex items-center justify-center">
        <motion.div
          initial={{ scale: 0, rotate: -8 }}
          animate={{ scale: [0, 1.5, 1.1, 1.2, 1], rotate: [-8, -2, 4, -2, 0] }}
          transition={{ duration: 1.2, ease: 'easeOut' }}
          className="text-center"
        >
          <div
            className="text-5xl font-black text-rose-300 drop-shadow-2xl sm:text-8xl"
            style={{ textShadow: '0 6px 20px rgba(255,0,40,0.6)' }}
          >
            {type === 'zilzila' ? 'ZILZILA!' : 'SUV TOSHQINI!'}
          </div>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            transition={{ delay: 0.7 }}
            className="mt-2 text-base font-bold uppercase tracking-[0.3em] text-white/90 sm:text-xl"
          >
            Shahar silkitildi...
          </motion.div>
        </motion.div>
      </div>
    </motion.div>
  );
}

function DisasterModal({
  type, affectedNames, budgetLoss, onContinue,
}: {
  type: DisasterType; affectedNames: string[]; budgetLoss: number; onContinue: () => void;
}) {
  const isQuake = type === 'zilzila';
  const Icon = isQuake ? Zap : Waves;
  const title = isQuake ? 'ZILZILA — TAFSILOT' : 'SUV TOSHQINI — TAFSILOT';

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-md"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
    >
      <motion.div
        initial={{ scale: 0.7, y: -40 }}
        animate={{ scale: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 220, damping: 16 }}
        className="w-full max-w-xl overflow-hidden rounded-3xl border-2 border-rose-500/60 bg-gradient-to-br from-rose-950 to-slate-900 shadow-2xl"
      >
        <div className="flex items-center gap-2 bg-rose-600 px-4 py-2 text-xs font-extrabold uppercase tracking-[0.25em] text-white">
          <Newspaper className="h-4 w-4" /> So'nggi xabar · Shoshilinch
        </div>
        <div className="p-5">
          <div className="mb-3 flex items-start gap-3">
            <div className="rounded-2xl bg-rose-500/20 p-3">
              <Icon className="h-8 w-8 text-rose-300" />
            </div>
            <div>
              <div className="text-xl font-extrabold text-rose-300">{title}</div>
              <div className="text-white/80">
                {affectedNames.length > 0 ? "Past sifatli inshootlar ta'sir oldi" : 'Shahar bardosh berdi'}
              </div>
            </div>
          </div>

          {affectedNames.length > 0 ? (
            <div className="rounded-2xl border border-rose-500/40 bg-rose-500/5 p-4">
              <div className="mb-2 flex items-center gap-2 text-sm font-bold text-rose-300">
                <AlertTriangle className="h-4 w-4" /> Qulagan inshootlar:
              </div>
              <ul className="space-y-1.5 text-sm text-white/90">
                {affectedNames.map((n) => (
                  <li key={n} className="flex items-center gap-2">
                    <Skull className="h-4 w-4 text-rose-400" />
                    <span className="font-semibold">{n}</span> — Vayrona
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="rounded-2xl border border-emerald-500/40 bg-emerald-500/5 p-4 text-emerald-300">
              <div className="font-bold">Hech narsa qulamadi.</div>
              <div className="text-sm text-emerald-300/80">
                Mustahkam qurilgan inshootlar tabiatga bardosh berdi.
              </div>
            </div>
          )}

          <div className="mt-4 flex items-center justify-between rounded-lg bg-white/5 p-3 text-sm">
            <span className="text-white/70">Ta'mirlash xarajati:</span>
            <span className="font-mono font-bold text-rose-300">
              −{budgetLoss.toLocaleString('en-US').replace(/,/g, ' ')} tanga
            </span>
          </div>

          <button
            onClick={() => { audio.click(); onContinue(); }}
            className="mt-4 w-full rounded-xl bg-rose-500 px-4 py-3 font-extrabold text-white transition hover:bg-rose-400"
          >
            Davom etish
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ============================================================================
//  TIME-PASSES CINEMATIC
// ============================================================================

// Multi-year time progression — 3 stages, each more dramatic
const TIME_STAGES: { years: number; label: string; subtitle: string; voice: string; durationMs: number }[] = [
  {
    years: 5,
    label: '5 YIL KEYIN',
    subtitle: "Shahar yashayapti. Bolalar maktabga ketmoqda, odamlar ishga shoshmoqda...",
    voice: "Besh yil o'tdi.",
    durationMs: 3200,
  },
  {
    years: 10,
    label: '10 YIL KEYIN',
    subtitle: "Birinchi yoriqlar paydo bo'ldi. Sifatsiz binolar belgi bera boshladi...",
    voice: "O'n yil o'tdi.",
    durationMs: 3500,
  },
  {
    years: 15,
    label: '15 YIL KEYIN',
    subtitle: "Avlodlar yashayapti. Qaroringizning oqibati endi yaqqol ko'rinadi...",
    voice: "O'n besh yil o'tdi.",
    durationMs: 3800,
  },
];

function TimePassesScene({ onDone }: { onDone: () => void }) {
  const [stageIdx, setStageIdx] = useState(0);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  useEffect(() => {
    if (stageIdx >= TIME_STAGES.length) {
      onDoneRef.current();
      return;
    }
    const stage = TIME_STAGES[stageIdx];
    audio.speak(stage.voice, { rate: 0.95 });
    const t = setTimeout(() => setStageIdx((i) => i + 1), stage.durationMs);
    return () => clearTimeout(t);
  }, [stageIdx]);

  if (stageIdx >= TIME_STAGES.length) return null;
  const stage = TIME_STAGES[stageIdx];

  return (
    <motion.div
      key={stageIdx}
      className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden bg-black"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
    >
      {/* Spinning clock background */}
      <motion.div
        key={`clock-${stageIdx}`}
        className="absolute inset-0 flex items-center justify-center text-[28rem] opacity-5"
        animate={{ rotate: 360 }}
        transition={{ repeat: Infinity, duration: 6 - stageIdx, ease: 'linear' }}
      >
        🕐
      </motion.div>

      {/* Calendar pages flipping animation */}
      {stageIdx > 0 && (
        <motion.div
          className="absolute inset-0 pointer-events-none flex items-center justify-center"
          initial={{ opacity: 0 }} animate={{ opacity: 0.1 }}
        >
          <div className="text-[16rem]">📅</div>
        </motion.div>
      )}

      <motion.div
        initial={{ y: 30, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: -20, opacity: 0 }}
        transition={{ duration: 0.7 }}
        className="relative z-10 px-4 text-center"
      >
        <motion.div
          className="text-yellow-300 text-xs sm:text-sm font-bold"
          style={{ letterSpacing: '0.6em' }}
          animate={{ opacity: [0.4, 1, 0.4] }}
          transition={{ repeat: Infinity, duration: 2 }}
        >
          VAQT O'TMOQDA — BOSQICH {stageIdx + 1}/{TIME_STAGES.length}
        </motion.div>
        <motion.div
          initial={{ scale: 1.3 }} animate={{ scale: 1 }}
          transition={{ duration: 1, delay: 0.3 }}
          className="mt-3 text-6xl font-black text-white sm:text-8xl"
          style={{
            textShadow: stageIdx >= 2 ? '0 0 40px rgba(244,63,94,0.5)' : 'none',
          }}
        >
          {stage.label}
        </motion.div>
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          transition={{ delay: 1.2, duration: 0.6 }}
          className="mt-4 max-w-2xl mx-auto text-base text-white/70 sm:text-xl"
        >
          {stage.subtitle}
        </motion.div>

        {/* Stage progress dots */}
        <div className="mt-8 flex justify-center gap-2">
          {TIME_STAGES.map((_, i) => (
            <span
              key={i}
              className={`h-2 w-12 rounded-full transition-colors ${
                i < stageIdx
                  ? 'bg-yellow-400'
                  : i === stageIdx
                    ? 'bg-yellow-400/60 animate-pulse'
                    : 'bg-white/15'
              }`}
            />
          ))}
        </div>
      </motion.div>
    </motion.div>
  );
}

// ============================================================================
//  LIVING-CITY OVERLAY (very minimal — just shows the 3D scene with a tooltip)
// ============================================================================

function LivingCityOverlay({ onDone }: { onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 4000);
    return () => clearTimeout(t);
  }, [onDone]);

  return (
    <motion.div
      className="pointer-events-none fixed inset-x-0 bottom-12 z-30 flex justify-center px-4"
      initial={{ y: 30, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: -10, opacity: 0 }}
    >
      <div className="rounded-2xl border-2 border-yellow-400/40 bg-slate-950/85 px-5 py-3 backdrop-blur shadow-2xl">
        <div className="text-[10px] font-bold uppercase tracking-[0.3em] text-yellow-300">
          Sizning shahringiz
        </div>
        <div className="text-base font-extrabold text-white sm:text-lg">
          Odamlar yashayapti, ishga ketmoqda...
        </div>
      </div>
    </motion.div>
  );
}

// ============================================================================
//  INCIDENT REPORT — citizen brings urgent news
// ============================================================================

function IncidentReportScene({
  report, current, total, onContinue,
}: {
  report: IncidentReport;
  current: number;
  total: number;
  onContinue: () => void;
}) {
  const [textDone, setTextDone] = useState(false);
  useEffect(() => {
    setTextDone(false);
    audio.speak(report.voiceLine, { rate: 1, pitch: 0.95 });
  }, [report.voiceLine]);

  return (
    <motion.div
      key={`incident-${report.buildingId}`}
      className="fixed inset-0 z-40"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      transition={{ duration: 0.4 }}
    >
      <div className={`absolute inset-0 bg-gradient-to-br ${report.citizen.bg}`} />
      {/* Police-style flashing light at top */}
      <motion.div
        className="absolute inset-x-0 top-0 h-1.5"
        animate={{ backgroundColor: ['#dc2626', '#1e3a8a', '#dc2626'] }}
        transition={{ repeat: Infinity, duration: 0.8 }}
      />
      <div
        className="absolute inset-0 opacity-30"
        style={{
          background:
            'radial-gradient(circle at 30% 20%, rgba(255,255,255,0.15), transparent 50%), radial-gradient(circle at 70% 80%, rgba(0,0,0,0.5), transparent 60%)',
        }}
      />

      <div className="relative flex min-h-full items-end px-3 pb-4 pt-24 sm:items-center sm:px-8 sm:pb-8">
        <div className="mx-auto grid w-full max-w-6xl items-center gap-8 sm:grid-cols-[auto_1fr] sm:gap-12">
          <motion.div
            initial={{ x: -50, scale: 0.8, opacity: 0 }}
            animate={{ x: 0, scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 180 }}
            className="flex justify-center sm:justify-start"
          >
            <div className="relative h-52 w-52 overflow-hidden rounded-full border-[6px] border-rose-400/70 shadow-2xl sm:h-72 sm:w-72">
              <div className={`absolute inset-0 bg-gradient-to-br ${report.citizen.bg}`} />
              <motion.div
                className="absolute inset-0 flex items-center justify-center"
                animate={!textDone ? { y: [0, -3, 0], rotate: [-2, 2, -2] } : {}}
                transition={{ repeat: !textDone ? Infinity : 0, duration: 0.6 }}
              >
                <span className="text-[7rem] leading-none drop-shadow-2xl sm:text-[9rem]">
                  {report.citizen.emoji}
                </span>
              </motion.div>
              <div className="absolute inset-0 ring-1 ring-inset ring-white/10" />
            </div>
          </motion.div>

          <div className="min-w-0">
            {/* Breaking news bar */}
            <motion.div
              initial={{ x: -20, opacity: 0 }} animate={{ x: 0, opacity: 1 }}
              className="mb-3 inline-flex items-center gap-2 rounded-full bg-rose-600 px-3 py-1 text-[10px] uppercase tracking-[0.3em] text-white"
            >
              <Newspaper className="h-3 w-3" />
              Hodisa #{current + 1}/{total}
            </motion.div>

            <motion.div
              initial={{ x: -20, opacity: 0 }} animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="mb-3 text-2xl font-black leading-tight text-rose-200 sm:text-3xl"
            >
              {report.headline}
            </motion.div>

            {/* Citizen name plate */}
            <motion.div
              initial={{ x: -20, opacity: 0 }} animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="mb-3 inline-flex items-center gap-2 rounded-xl border border-yellow-400/40 bg-black/40 px-3 py-1.5 backdrop-blur"
            >
              <span className="text-xl">{report.citizen.emoji}</span>
              <div>
                <div className="text-sm font-extrabold text-white">{report.citizen.name}</div>
                <div className="text-[10px] uppercase tracking-wider text-yellow-300/80">
                  {report.citizen.role}
                </div>
              </div>
            </motion.div>

            {/* Speech bubble */}
            <div className="relative mb-5">
              <div className="rounded-3xl bg-white px-5 py-4 text-[15px] leading-relaxed text-slate-900 shadow-2xl sm:px-6 sm:py-5 sm:text-base">
                <TypewriterLine
                  text={report.message}
                  speed={18}
                  onDone={() => setTextDone(true)}
                  dark
                />
              </div>
              <div className="absolute -left-3 top-12 hidden h-0 w-0 border-y-[14px] border-r-[18px] border-y-transparent border-r-white sm:block" />
            </div>

            <motion.button
              initial={{ opacity: 0 }} animate={{ opacity: textDone ? 1 : 0.4 }}
              whileHover={textDone ? { scale: 1.04, y: -2 } : undefined}
              whileTap={textDone ? { scale: 0.97 } : undefined}
              disabled={!textDone}
              onClick={() => { audio.click(); onContinue(); }}
              className="rounded-2xl bg-rose-500 px-6 py-3 text-base font-extrabold text-white shadow-2xl transition hover:bg-rose-400 disabled:opacity-40"
            >
              {current + 1 >= total ? "Yakuniy oqibatlar" : "Keyingi xabar"} <ChevronRight className="ml-0.5 inline h-5 w-5" />
            </motion.button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ============================================================================
//  AI JUDGE
// ============================================================================

function AIJudgeSprite() {
  return (
    <motion.div
      className="pointer-events-none fixed bottom-3 right-3 z-20 flex flex-col items-center"
      animate={{ y: [0, -6, 0] }}
      transition={{ repeat: Infinity, duration: 2.4, ease: 'easeInOut' }}
    >
      <div className="rounded-full bg-yellow-400/20 p-2 backdrop-blur-sm">
        <div className="text-3xl sm:text-4xl">🦉</div>
      </div>
      <div className="mt-1 rounded-full bg-black/40 px-2 py-0.5 text-[9px] uppercase tracking-widest text-yellow-200/80">
        Donishmand
      </div>
    </motion.div>
  );
}

function AIJudgeModal({ loading, questions, onAck }: {
  loading: boolean; questions: string[]; onAck: () => void;
}) {
  return (
    <motion.div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
    >
      <motion.div
        initial={{ scale: 0, rotate: -45, y: 200 }}
        animate={{ scale: 1, rotate: 0, y: 0 }}
        exit={{ scale: 0, y: 200 }}
        transition={{ type: 'spring', stiffness: 220, damping: 18 }}
        className="w-full max-w-xl rounded-3xl border-2 border-yellow-400/40 bg-gradient-to-br from-slate-900 to-slate-800 p-5 shadow-2xl"
      >
        <div className="mb-4 flex items-center gap-3">
          <motion.div className="text-5xl"
            animate={{ rotate: [-8, 8, -4, 0] }}
            transition={{ duration: 0.7 }}>
            🦉
          </motion.div>
          <div>
            <div className="text-[10px] uppercase tracking-widest text-yellow-300">Donishmand boyqush</div>
            <div className="text-xl font-extrabold text-white">Bir necha savol bormi sizdan...</div>
          </div>
        </div>

        <div className="space-y-3">
          {loading && (
            <div className="flex items-center gap-2 text-sm text-white/70">
              <div className="flex gap-1">
                <span className="h-2 w-2 animate-bounce rounded-full bg-yellow-400 [animation-delay:-0.3s]" />
                <span className="h-2 w-2 animate-bounce rounded-full bg-yellow-400 [animation-delay:-0.15s]" />
                <span className="h-2 w-2 animate-bounce rounded-full bg-yellow-400" />
              </div>
              Donishmand savol o'ylamoqda...
            </div>
          )}
          {!loading && questions.map((q, i) => (
            <motion.div key={i}
              initial={{ x: -10, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: i * 0.4 }}
              className="flex gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-4 leading-relaxed">
              <div className="shrink-0 rounded-md bg-yellow-400/20 px-2 py-0.5 text-xs font-bold text-yellow-300">
                {i + 1}
              </div>
              <div className="text-[15px] text-white/95">
                <TypewriterLine text={q} delay={i * 1800} />
              </div>
            </motion.div>
          ))}
        </div>

        {!loading && (
          <button onClick={() => { audio.click(); onAck(); }}
            className="mt-5 w-full rounded-xl bg-yellow-400 px-4 py-3 font-extrabold text-slate-900 transition hover:bg-yellow-300">
            O'ylab ko'raman
          </button>
        )}
      </motion.div>
    </motion.div>
  );
}

// ============================================================================
//  FRIEND VISIT
// ============================================================================

function FriendPicker({ friends, onPick, onClose }: {
  friends: Friend[]; onPick: (f: Friend) => void; onClose: () => void;
}) {
  return (
    <motion.div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/65 p-4"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, y: 30 }} animate={{ scale: 1, y: 0 }}
        className="w-full max-w-xl rounded-3xl border border-white/15 bg-slate-900 p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <div>
            <div className="text-[10px] uppercase tracking-widest text-yellow-300/80">Do'stim shahri</div>
            <div className="text-xl font-extrabold">Kim bilan tanishasiz?</div>
          </div>
          <button onClick={onClose} className="rounded-lg bg-white/10 p-2 text-white/70 hover:bg-white/20">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          {friends.map((f) => (
            <motion.button key={f.id}
              whileHover={{ y: -3, scale: 1.02 }} whileTap={{ scale: 0.97 }}
              onClick={() => { audio.click(); onPick(f); }}
              className="flex flex-col items-center rounded-2xl border border-white/10 bg-white/5 p-4 text-center transition hover:bg-white/10">
              <div className="text-5xl">{f.avatar}</div>
              <div className="mt-2 font-extrabold text-white">{f.name}</div>
              <div className={`mt-1 rounded-full px-2 py-0.5 text-xs font-bold ${
                f.integrity >= 70 ? 'bg-emerald-500/20 text-emerald-300'
                  : f.integrity >= 40 ? 'bg-amber-500/20 text-amber-300'
                    : 'bg-rose-500/20 text-rose-300'
              }`}>
                Halollik: {f.integrity}
              </div>
              <div className="mt-2 text-xs leading-snug text-white/70">{f.tagline}</div>
            </motion.button>
          ))}
        </div>
      </motion.div>
    </motion.div>
  );
}

function FriendBanner({ friend }: { friend: Friend }) {
  return (
    <motion.div
      initial={{ y: -30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -30, opacity: 0 }}
      className="pointer-events-none fixed inset-x-0 top-20 z-20 flex justify-center px-4"
    >
      <div className="pointer-events-auto flex items-center gap-3 rounded-2xl border-2 border-yellow-400/40 bg-slate-900/85 px-4 py-2 shadow-xl backdrop-blur">
        <div className="text-3xl">{friend.avatar}</div>
        <div>
          <div className="text-xs font-bold uppercase tracking-wider text-yellow-300">
            {friend.name}ning shahri
          </div>
          <div className="max-w-md text-xs text-white/85">{friend.tagline}</div>
        </div>
      </div>
    </motion.div>
  );
}

// ============================================================================
//  START / GAME OVER
// ============================================================================

// ============================================================================
//  INTRO CINEMATIC — first impression hook (~20s)
// ============================================================================

interface IntroScene {
  bg: string;            // tailwind gradient
  emoji: string;         // big focal emoji (or list)
  title: string;
  subtitle?: string;
  durationMs: number;
  audioCue?: 'chime' | 'beat' | 'sparkle' | 'thump';
}

const INTRO_SCENES: IntroScene[] = [
  {
    bg: 'from-amber-300 via-orange-500 to-rose-700',
    emoji: '🌅',
    title: "Bu — sizning shahringiz",
    subtitle: 'Toshkent. Tong otmoqda. Ko\'chalar uyg\'onmoqda...',
    durationMs: 3200,
    audioCue: 'chime',
  },
  {
    bg: 'from-sky-700 via-indigo-800 to-slate-900',
    emoji: '👦 👧 🧒 🧔',
    title: 'Bu — sizning shahringizdagi odamlar',
    subtitle: "Akbar, Munisa, Bobur, Karim aka — har biri o'z hayotida",
    durationMs: 3500,
    audioCue: 'beat',
  },
  {
    bg: 'from-rose-700 via-purple-800 to-slate-950',
    emoji: '📝 🎁 💵 🪟 🎧',
    title: "Bugun sizni dilemmalar kutmoqda",
    subtitle: "Imtihon, sovg'a, pul, sir, mahsulot — har biri tanlov",
    durationMs: 3800,
    audioCue: 'thump',
  },
  {
    bg: 'from-yellow-600 via-amber-700 to-stone-950',
    emoji: '⚖️',
    title: "Halol qaror qilasizmi?",
    subtitle: "Yoki yengil yo'lni tanlaysizmi?",
    durationMs: 3500,
    audioCue: 'beat',
  },
  {
    bg: 'from-emerald-700 via-teal-800 to-slate-950',
    emoji: '🏙️',
    title: 'INTEGRITY CITY',
    subtitle: "Bilim emas — TAJRIBA. Halollikni qo'lingiz bilan his qiling.",
    durationMs: 4500,
    audioCue: 'sparkle',
  },
];

function IntroCinematic({ onDone }: { onDone: () => void }) {
  const [sceneIdx, setSceneIdx] = useState(0);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  useEffect(() => {
    audio.unlock();
    if (sceneIdx >= INTRO_SCENES.length) {
      onDoneRef.current();
      return;
    }
    const scene = INTRO_SCENES[sceneIdx];
    // Audio cue per scene
    if (scene.audioCue === 'chime') audio.coin();
    if (scene.audioCue === 'beat') audio.heartbeat(0.4);
    if (scene.audioCue === 'thump') audio.disaster();
    if (scene.audioCue === 'sparkle') audio.victory();

    const t = setTimeout(() => setSceneIdx((i) => i + 1), scene.durationMs);
    return () => clearTimeout(t);
  }, [sceneIdx]);

  function skip() {
    audio.click();
    onDoneRef.current();
  }

  if (sceneIdx >= INTRO_SCENES.length) return null;
  const scene = INTRO_SCENES[sceneIdx];
  const totalDuration = INTRO_SCENES.reduce((s, x) => s + x.durationMs, 0);
  const elapsedDuration = INTRO_SCENES.slice(0, sceneIdx).reduce((s, x) => s + x.durationMs, 0);

  return (
    <motion.div
      key={sceneIdx}
      className="fixed inset-0 z-[60] flex flex-col items-center justify-center overflow-hidden"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.6 }}
    >
      {/* Animated gradient background */}
      <motion.div
        key={`bg-${sceneIdx}`}
        className={`absolute inset-0 bg-gradient-to-br ${scene.bg}`}
        initial={{ scale: 1.1, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.8 }}
      />

      {/* Pattern overlay */}
      <motion.div
        key={`pattern-${sceneIdx}`}
        className="absolute inset-0 opacity-10"
        animate={{ backgroundPositionX: ['0%', '100%'] }}
        transition={{ repeat: Infinity, duration: 12, ease: 'linear' }}
        style={{
          backgroundImage:
            'repeating-linear-gradient(45deg, rgba(255,255,255,0.2) 0 12px, transparent 12px 32px)',
        }}
      />

      {/* Vignette */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: 'radial-gradient(ellipse at center, transparent 35%, rgba(0,0,0,0.55) 100%)',
        }}
      />

      {/* Content */}
      <motion.div
        key={`content-${sceneIdx}`}
        initial={{ y: 30, opacity: 0, scale: 0.9 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        transition={{ duration: 0.7, delay: 0.2 }}
        className="relative z-10 px-4 text-center"
      >
        <motion.div
          initial={{ scale: 0, rotate: -10 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ delay: 0.4, type: 'spring', stiffness: 180 }}
          className="text-7xl drop-shadow-2xl sm:text-9xl"
          style={{ letterSpacing: '0.2em' }}
        >
          {scene.emoji}
        </motion.div>
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.8, duration: 0.6 }}
          className="mt-6 text-3xl font-black leading-tight text-white drop-shadow-lg sm:text-5xl"
        >
          {scene.title}
        </motion.div>
        {scene.subtitle && (
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 0.9 }}
            transition={{ delay: 1.2, duration: 0.6 }}
            className="mt-4 max-w-2xl text-base leading-relaxed text-white/85 sm:text-xl"
          >
            {scene.subtitle}
          </motion.div>
        )}
      </motion.div>

      {/* Bottom: progress bar + skip */}
      <div className="absolute inset-x-0 bottom-0 z-20 flex items-center justify-between gap-3 px-4 pb-6 sm:px-8 sm:pb-8">
        <div className="flex flex-1 gap-1.5">
          {INTRO_SCENES.map((_, i) => (
            <div key={i} className="h-1 flex-1 overflow-hidden rounded-full bg-white/20">
              {i < sceneIdx && <div className="h-full w-full bg-white" />}
              {i === sceneIdx && (
                <motion.div
                  className="h-full bg-white"
                  initial={{ width: '0%' }}
                  animate={{ width: '100%' }}
                  transition={{ duration: scene.durationMs / 1000, ease: 'linear' }}
                />
              )}
            </div>
          ))}
        </div>
        <button
          onClick={skip}
          className="rounded-xl bg-white/15 px-4 py-2 text-xs font-bold uppercase tracking-wider text-white backdrop-blur transition hover:bg-white/25 sm:text-sm"
        >
          O'tkazish →
        </button>
      </div>

      {/* Final scene CTA */}
      {sceneIdx === INTRO_SCENES.length - 1 && (
        <motion.button
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 2, duration: 0.6 }}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.97 }}
          onClick={skip}
          className="absolute z-30 mt-72 rounded-2xl bg-yellow-400 px-8 py-4 text-lg font-black text-slate-900 shadow-2xl transition hover:bg-yellow-300"
          style={{ marginTop: '20rem' }}
        >
          🎮 Boshlash
        </motion.button>
      )}
    </motion.div>
  );
}

function StartScreen({ onStart }: { onStart: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }}
      className="relative z-10 flex min-h-screen flex-col items-center justify-center gap-5 px-4 py-10 text-center"
    >
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 200 }}
      >
        <div className="text-7xl sm:text-8xl">🏙️</div>
      </motion.div>
      <div className="rounded-full bg-yellow-400/20 px-4 py-1 text-xs uppercase tracking-[0.3em] text-yellow-200">
        Ta'limiy o'yin · 11–13 yosh
      </div>
      <h1 className="bg-gradient-to-br from-white to-yellow-300 bg-clip-text text-5xl font-black leading-none text-transparent sm:text-7xl">
        IntegrityCity
      </h1>
      <div className="-mt-3 text-xl font-extrabold text-white/90 sm:text-2xl">Halollik shahri</div>

      <p className="max-w-2xl text-base leading-relaxed text-white/85 sm:text-lg">
        Siz — shahar uchun bino qurayotgan boy odamsiz. Sizga odamlar keladi va taklif aytadi.
        Halol qarorda — fuqarolar duo qiladi, bonus pul keladi.
        Yengil yo'lda — yillar o'tib bino qulashi mumkin.
        Sherigingiz Otabek esa siz qiladigan tanlovning aksini qiladi — oxirida kim yutadi?
      </p>

      <motion.button
        whileHover={{ scale: 1.05, y: -2 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => { audio.unlock(); audio.click(); onStart(); }}
        className="rounded-2xl bg-yellow-400 px-10 py-5 text-xl font-black text-slate-900 shadow-2xl transition hover:bg-yellow-300"
      >
        🎮 O'yinni boshlash
      </motion.button>

      <div className="flex items-center gap-2 text-xs text-white/55">
        <MessageCircle className="h-3.5 w-3.5" /> Diqqat bilan o'qing — har gap ahamiyatga ega.
      </div>
    </motion.div>
  );
}

function Stat({ icon, label, value, accent }: {
  icon: string; label: string; value: string; accent?: string;
}) {
  return (
    <div className="rounded-xl bg-black/30 p-3">
      <div className="text-xs uppercase tracking-widest text-white/60">
        {icon} {label}
      </div>
      <div className={`mt-0.5 font-mono text-lg font-extrabold ${accent ?? 'text-white'}`}>
        {value}
      </div>
    </div>
  );
}

function GameOverScreen({
  buildings, history, budget, integrity, personalEarnings, onRestart,
  otabekBuildings, otabekIntegrity, otabekBudget, otabekEarnings,
}: {
  buildings: BuildingsMap; history: HistoryEntry[]; budget: number; integrity: number;
  personalEarnings: number; onRestart: () => void;
  otabekBuildings: BuildingsMap; otabekIntegrity: number; otabekBudget: number;
  otabekEarnings: number;
}) {
  const all = Object.values(buildings);
  const ruined = all.filter((b) => b.status === 'vayrona').length;
  const fragile = all.filter((b) => b.isFragile && b.status !== 'vayrona').length;
  const good = all.filter((b) => b.status === 'alo' && !b.isFragile).length;

  let title = ''; let body = ''; let emoji = '🏆'; let tone = ''; let voicePhrase = '';
  if (integrity >= 80 && ruined === 0) {
    title = "Buyuk meros"; emoji = '🏆';
    body = "Siz halol odam bo'ldingiz! Sizning shahringiz uzoq yashaydi va farzandlaringizga ham qoladi.";
    tone = 'border-emerald-400/50 from-emerald-500/20';
    voicePhrase = "Tabriklaymiz! Sizning shahringiz haqiqiy meros bo'ldi.";
  } else if (integrity >= 50 && ruined <= 1) {
    title = "O'rtacha shahar"; emoji = '⚖️';
    body = "Shahar omon qoldi, lekin ba'zi joylarda muammolar ko'rindi. Halolroq bo'lsangiz bo'lardi.";
    tone = 'border-amber-400/50 from-amber-500/20';
    voicePhrase = "Shahar omon qoldi, lekin yana yaxshiroq qilsa bo'lar edi.";
  } else {
    title = "Qog'ozdan shahar"; emoji = '💀';
    body = "Shahringiz tashqaridan chiroyli ko'rinardi, lekin ichi bo'sh edi. Korrupsiyaning oqibatini begunoh odamlar tortdi.";
    tone = 'border-rose-400/50 from-rose-500/20';
    voicePhrase = "Sizning shahringiz vayron bo'ldi.";
  }

  // Play victory or defeat once on mount
  useEffect(() => {
    if (integrity >= 80 && ruined === 0) {
      audio.victory();
    } else if (integrity < 50 || ruined > 1) {
      audio.defeat();
    } else {
      audio.buildComplete();
    }
    setTimeout(() => audio.speak(voicePhrase), 700);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <motion.div
      className="relative z-10 mx-auto max-w-3xl px-4 py-10"
      initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
    >
      <div className={`overflow-hidden rounded-3xl border-2 bg-gradient-to-br ${tone} to-slate-900 shadow-2xl`}>
        <div className="p-6">
          <div className="mb-3 flex items-center gap-3">
            <div className="text-5xl">{emoji}</div>
            <div>
              <div className="text-xs uppercase tracking-widest text-white/60">Sizning merosingiz</div>
              <div className="text-3xl font-black text-white">{title}</div>
            </div>
          </div>
          <p className="text-base leading-relaxed text-white/90">{body}</p>

          <div className="mt-5 grid gap-2 sm:grid-cols-3">
            <Stat icon="🛡️" label="Halollik" value={`${Math.round(integrity)}/100`} />
            <Stat icon="💰" label="Byudjet" value={budget.toLocaleString('en-US').replace(/,/g, ' ')} />
            <Stat icon="🤫" label="«Konvert»dan"
              value={`+${personalEarnings.toLocaleString('en-US').replace(/,/g, ' ')}`}
              accent={personalEarnings > 0 ? 'text-rose-300' : 'text-white/70'} />
          </div>

          <div className="mt-4 grid gap-2 text-sm sm:grid-cols-3">
            <div className="rounded-lg bg-emerald-500/10 px-3 py-2 text-emerald-300">
              ✅ Yaxshi: <b>{good}</b>
            </div>
            <div className="rounded-lg bg-amber-500/10 px-3 py-2 text-amber-300">
              ⚠ Past sifat: <b>{fragile}</b>
            </div>
            <div className="rounded-lg bg-rose-500/10 px-3 py-2 text-rose-300">
              💥 Vayrona: <b>{ruined}</b>
            </div>
          </div>
        </div>

        <div className="border-t border-white/10 bg-black/25 p-5">
          <div className="mb-2 text-xs font-bold uppercase tracking-wider text-yellow-300/80">
            Qarorlar tarixi
          </div>
          <ul className="space-y-1.5 text-sm">
            {history.map((h) => (
              <li key={h.round}
                className={`flex items-center justify-between rounded-lg border px-3 py-2 ${
                  !h.isCorrupt ? 'border-emerald-400/30 bg-emerald-500/5'
                    : 'border-rose-400/30 bg-rose-500/5'
                }`}>
                <span>
                  <span className="mr-2 text-white/50">#{h.round}</span>
                  {h.buildingName}
                </span>
                <span className={`text-xs font-bold uppercase ${
                  !h.isCorrupt ? 'text-emerald-300' : 'text-rose-300'
                }`}>
                  {!h.isCorrupt ? 'Halol' : `«Konvert» +${h.bonus}`}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* RIVAL COMPARISON — your city vs Otabek's */}
      <RivalComparison
        myBuildings={buildings}
        myIntegrity={integrity}
        myBudget={budget}
        myEarnings={personalEarnings}
        otBuildings={otabekBuildings}
        otIntegrity={otabekIntegrity}
        otBudget={otabekBudget}
        otEarnings={otabekEarnings}
      />

      <motion.button
        whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
        onClick={() => { audio.click(); onRestart(); }}
        className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl bg-yellow-400 px-6 py-4 font-black text-slate-900 transition hover:bg-yellow-300"
      >
        <RotateCcw className="h-5 w-5" /> Qaytadan boshlash
      </motion.button>
    </motion.div>
  );
}

// ============================================================================
//  RIVAL COMPARISON PANEL
// ============================================================================

function MiniCity({
  buildings, label, sublabel,
}: {
  buildings: BuildingsMap;
  label: string;
  sublabel: string;
}) {
  const ids: BuildingId[] = ['maktab', 'shifoxona', 'bogcha'];
  return (
    <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
      <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.25em] text-yellow-300">
        {label}
      </div>
      <div className="mb-3 text-sm font-extrabold text-white">{sublabel}</div>
      <div className="flex flex-wrap gap-2">
        {ids.map((id) => {
          const b = buildings[id];
          const status = b.status;
          const bg =
            status === 'alo' && !b.isFragile ? 'bg-emerald-500/20 border-emerald-400/40'
              : status === 'alo' && b.isFragile ? 'bg-amber-500/20 border-amber-400/40'
              : status === 'shikastlangan' ? 'bg-amber-500/20 border-amber-400/40'
              : status === 'vayrona' ? 'bg-rose-500/20 border-rose-400/40'
              : 'bg-slate-700/30 border-white/10';
          const emoji =
            status === 'qurilmagan' ? '🚧'
              : status === 'vayrona' ? '💥'
              : BUILDING_EMOJI[id];
          return (
            <div
              key={id}
              className={`flex h-14 w-14 items-center justify-center rounded-xl border-2 text-2xl ${bg} ${status === 'vayrona' ? 'animate-pulse' : ''}`}
              title={`${BUILDING_NAME[id]} — ${status}`}
            >
              {emoji}
              {b.isFragile && status === 'alo' && (
                <span className="absolute mt-8 text-[10px]">💨</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function RivalComparison({
  myBuildings, myIntegrity, myBudget, myEarnings,
  otBuildings, otIntegrity, otBudget, otEarnings,
}: {
  myBuildings: BuildingsMap; myIntegrity: number; myBudget: number; myEarnings: number;
  otBuildings: BuildingsMap; otIntegrity: number; otBudget: number; otEarnings: number;
}) {
  const myRuined = Object.values(myBuildings).filter((b) => b.status === 'vayrona').length;
  const myGood = Object.values(myBuildings).filter((b) => b.status === 'alo' && !b.isFragile).length;
  const otRuined = Object.values(otBuildings).filter((b) => b.status === 'vayrona').length;
  const otGood = Object.values(otBuildings).filter((b) => b.status === 'alo' && !b.isFragile).length;

  const myTotal = myBudget + myEarnings;
  const otTotal = otBudget + otEarnings;

  // Verdict — who's better off long-term
  let verdict = '';
  let verdictTone = '';
  if (myIntegrity > otIntegrity + 20 && myRuined < otRuined) {
    verdict = "Otabek bugun ko'p pul oldi — lekin sizning shahringiz uzoq yashaydi.";
    verdictTone = 'border-emerald-400/40 bg-emerald-500/10 text-emerald-200';
  } else if (otIntegrity > myIntegrity + 20 && otRuined < myRuined) {
    verdict = "Otabek halol qoldi. Uning shahri yashayapti — siznikini esa qulagan.";
    verdictTone = 'border-rose-400/40 bg-rose-500/10 text-rose-200';
  } else {
    verdict = "Ikkalangiz o'rtasida farq oz — lekin har bir tanlov muhim.";
    verdictTone = 'border-amber-400/40 bg-amber-500/10 text-amber-200';
  }

  return (
    <motion.div
      initial={{ y: 30, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ delay: 0.4, duration: 0.6 }}
      className="mt-6 rounded-3xl border-2 border-white/10 bg-gradient-to-br from-slate-900 to-slate-950 p-5 shadow-2xl"
    >
      <div className="mb-4 flex items-center gap-3">
        <div className="text-4xl">⚖️</div>
        <div>
          <div className="text-xs uppercase tracking-widest text-white/60">
            Solishtirish — siz va sherigingiz
          </div>
          <div className="text-2xl font-black text-white">15 yil keyin</div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <MiniCity
          buildings={myBuildings}
          label="🧑 SIZNING SHAHRINGIZ"
          sublabel={
            myIntegrity >= 70 ? 'Halol va mustahkam'
              : myIntegrity >= 40 ? "Aralash holat"
              : 'Vayron va qorong\'i'
          }
        />
        <MiniCity
          buildings={otBuildings}
          label="🧔 OTABEK SHAHRI"
          sublabel={
            otIntegrity >= 70 ? 'Halol va mustahkam'
              : otIntegrity >= 40 ? "Aralash holat"
              : 'Vayron va qorong\'i'
          }
        />
      </div>

      <div className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
        <div className="rounded-xl bg-black/30 p-3">
          <div className="text-xs font-bold text-white/60">SIZ</div>
          <div className="mt-1 grid grid-cols-3 gap-2 text-xs">
            <span className="text-white/80">🛡️ {Math.round(myIntegrity)}</span>
            <span className="text-emerald-300">✓ {myGood}</span>
            <span className="text-rose-300">💥 {myRuined}</span>
          </div>
          <div className="mt-2 font-mono text-base font-extrabold text-yellow-300">
            💰 {myTotal.toLocaleString('en-US').replace(/,/g, ' ')} tanga
          </div>
          {myEarnings > 0 && (
            <div className="text-[10px] text-rose-300">
              ({myEarnings.toLocaleString('en-US').replace(/,/g, ' ')} «konvert»dan)
            </div>
          )}
        </div>
        <div className="rounded-xl bg-black/30 p-3">
          <div className="text-xs font-bold text-white/60">OTABEK</div>
          <div className="mt-1 grid grid-cols-3 gap-2 text-xs">
            <span className="text-white/80">🛡️ {Math.round(otIntegrity)}</span>
            <span className="text-emerald-300">✓ {otGood}</span>
            <span className="text-rose-300">💥 {otRuined}</span>
          </div>
          <div className="mt-2 font-mono text-base font-extrabold text-yellow-300">
            💰 {otTotal.toLocaleString('en-US').replace(/,/g, ' ')} tanga
          </div>
          {otEarnings > 0 && (
            <div className="text-[10px] text-rose-300">
              ({otEarnings.toLocaleString('en-US').replace(/,/g, ' ')} «konvert»dan)
            </div>
          )}
        </div>
      </div>

      <div className={`mt-4 rounded-2xl border p-4 text-center text-sm font-medium ${verdictTone}`}>
        {verdict}
      </div>
    </motion.div>
  );
}

// ============================================================================
//  SUGGESTIONS PANEL — "Bu yerga nima qurmoqchisiz?"
// ============================================================================

function SuggestionsPanel({
  plotIdx, builtIds, onPick, onClose,
}: {
  plotIdx: number;
  builtIds: BuildingId[];
  onPick: (id: BuildingId) => void;
  onClose: () => void;
}) {
  return (
    <motion.div
      initial={{ y: 240, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 240, opacity: 0 }}
      transition={{ type: 'spring', stiffness: 240, damping: 26 }}
      className="pointer-events-auto fixed inset-x-0 bottom-0 z-30 px-3 pb-4 sm:px-6 sm:pb-6"
    >
      <div className="mx-auto max-w-5xl rounded-3xl border-2 border-yellow-400/40 bg-slate-950/92 p-4 shadow-2xl backdrop-blur-md sm:p-5">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-[0.3em] text-yellow-300">
              📍 Yer uchastkasi #{plotIdx + 1} · Bo'sh
            </div>
            <div className="mt-0.5 text-xl font-extrabold leading-tight text-white sm:text-2xl">
              Bu yerga nima qurmoqchisiz?
            </div>
            <div className="mt-1 text-xs text-white/60">
              Har bir tanlovga turli quruvchi keladi va o'z taklifini aytadi.
            </div>
          </div>
          <button
            onClick={() => { audio.click(); onClose(); }}
            className="shrink-0 rounded-lg bg-white/10 p-2 text-white/70 transition hover:bg-white/20"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="grid gap-2.5 sm:grid-cols-3 lg:grid-cols-5">
          {ALL_BUILDING_IDS.map((id) => {
            const built = builtIds.includes(id);
            const sug = BUILDING_SUGGESTION[id];
            return (
              <motion.button
                key={id}
                whileHover={!built ? { y: -4, scale: 1.02 } : undefined}
                whileTap={!built ? { scale: 0.97 } : undefined}
                disabled={built}
                onClick={() => { if (!built) { audio.click(); onPick(id); } }}
                className={`group relative overflow-hidden rounded-2xl border-2 p-4 text-left transition ${
                  built
                    ? 'cursor-not-allowed border-white/10 bg-white/[0.03] opacity-50'
                    : 'border-yellow-400/30 bg-yellow-400/[0.05] hover:border-yellow-400/70 hover:bg-yellow-400/[0.12]'
                }`}
              >
                <div className="mb-2 text-4xl">{BUILDING_EMOJI[id]}</div>
                <div className="text-base font-extrabold text-white">{BUILDING_NAME[id]}</div>
                <div className="mt-1 text-[11px] leading-snug text-white/65">{sug.tagline}</div>
                <div className="mt-2 flex flex-col gap-0.5 text-[10px]">
                  <span className="text-yellow-300/80">💰 {sug.cost}</span>
                  <span className="text-emerald-300/80">✓ {sug.benefit}</span>
                </div>
                {built && (
                  <div className="absolute right-2 top-2 rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-300">
                    ✓ Qurildi
                  </div>
                )}
              </motion.button>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
}

// ============================================================================
//  MAIN APP
// ============================================================================

const CONSTRUCTION_MS = 3500;
const CELEBRATION_MS = 1900;

export default function App() {
  const [introDone, setIntroDone] = useState(false);
  const [phase, setPhase] = useState<Phase>('start');
  const [budget, setBudget] = useState(10000);
  const [integrity, setIntegrity] = useState(100);
  const [buildings, setBuildings] = useState<BuildingsMap>(FRESH_BUILDINGS);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [personalEarnings, setPersonalEarnings] = useState(0);
  const [muted, setMuted] = useState(false);

  // Plot assignments — each index 0..4 holds a buildingId or null (empty plot)
  const [plotAssignments, setPlotAssignments] = useState<(BuildingId | null)[]>(
    [null, null, null, null, null],
  );
  // Which plot the user clicked (for suggestions panel + active construction)
  const [selectedPlotIdx, setSelectedPlotIdx] = useState<number | null>(null);
  // Currently-active scenario (driven by user's pick, not round counter)
  const [currentBuildingId, setCurrentBuildingId] = useState<BuildingId | null>(null);
  // Whether the suggestions panel is open
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);

  const [chosenIdx, setChosenIdx] = useState<number | null>(null);
  const [coinTrigger, setCoinTrigger] = useState(0);
  const [bonusTrigger, setBonusTrigger] = useState(0);

  // ── Rival "Otabek" — silent rival making opposite choices ──
  const [otabekBuildings, setOtabekBuildings] = useState<BuildingsMap>(FRESH_BUILDINGS);
  const [otabekIntegrity, setOtabekIntegrity] = useState(100);
  const [otabekBudget, setOtabekBudget] = useState(10000);
  const [otabekEarnings, setOtabekEarnings] = useState(0);
  const otabekBuildingsRef = useRef(otabekBuildings);
  useEffect(() => { otabekBuildingsRef.current = otabekBuildings; }, [otabekBuildings]);

  const [constructionProgress, setConstructionProgress] = useState(0);
  const [buildStage, setBuildStage] = useState(0);

  const [aiQuestions, setAiQuestions] = useState<string[]>([]);
  const [aiLoading, setAiLoading] = useState(false);
  const [pendingScenarioForJudge, setPendingScenarioForJudge] = useState<Scenario | null>(null);

  const [disaster, setDisaster] = useState<{
    type: DisasterType; affectedNames: string[]; cost: number;
  } | null>(null);
  const [shakeKey, setShakeKey] = useState(0);

  const [friendPickerOpen, setFriendPickerOpen] = useState(false);
  const [visitingFriend, setVisitingFriend] = useState<Friend | null>(null);

  // Post-build incident report queue
  const [reportQueue, setReportQueue] = useState<BuildingId[]>([]);
  const [reportIndex, setReportIndex] = useState(0);

  const currentScenario = currentBuildingId
    ? SCENARIOS.find((s) => s.buildingId === currentBuildingId) ?? null
    : null;
  const displayBuildings = visitingFriend ? visitingFriend.buildings : buildings;
  const displayIntegrity = visitingFriend ? visitingFriend.integrity : integrity;
  const displayBudget = visitingFriend ? visitingFriend.budget : budget;
  const sky = useMemo(() => skyColors(displayIntegrity), [displayIntegrity]);

  const buildingsRef = useRef(buildings);
  useEffect(() => { buildingsRef.current = buildings; }, [buildings]);

  // Built buildings = those non-null in plotAssignments AND not in qurilyapti state
  const builtBuildingIds = useMemo(
    () => plotAssignments.filter((b): b is BuildingId => b !== null),
    [plotAssignments],
  );
  const builtCount = builtBuildingIds.filter((id) => buildings[id].status !== 'qurilyapti').length;

  // Plots view for the player's city
  const playerPlots: PlotData[] = plotAssignments.map((bid) => ({
    buildingId: bid,
    state: bid ? buildings[bid] : { status: 'qurilmagan', isFragile: false },
  }));
  // Plots view for a friend's city — natural order
  const friendPlots: PlotData[] = ALL_BUILDING_IDS.map((bid) => ({
    buildingId: bid,
    state: (visitingFriend?.buildings[bid] ?? { status: 'qurilmagan', isFragile: false }) as BuildingState,
  }));
  const displayPlots = visitingFriend ? friendPlots : playerPlots;

  const constructingPlotIdx = phase === 'building' && selectedPlotIdx !== null ? selectedPlotIdx : null;

  function startGame() {
    audio.unlock();
    setBudget(10000); setIntegrity(100);
    setBuildings({ ...FRESH_BUILDINGS });
    setHistory([]); setPersonalEarnings(0);
    setChosenIdx(null); setDisaster(null);
    setVisitingFriend(null); setPendingScenarioForJudge(null);
    setConstructionProgress(0);
    setPlotAssignments([null, null, null, null, null]);
    setSelectedPlotIdx(null);
    setCurrentBuildingId(null);
    setSuggestionsOpen(false);
    setBuildStage(0);
    // Reset rival
    setOtabekBuildings({ ...FRESH_BUILDINGS });
    setOtabekIntegrity(100);
    setOtabekBudget(10000);
    setOtabekEarnings(0);
    setPhase('idle');
  }

  function handlePlotClick(plotIdx: number) {
    if (phase !== 'idle' || visitingFriend) return;
    if (plotAssignments[plotIdx]) return;
    audio.click();
    setSelectedPlotIdx(plotIdx);
    setSuggestionsOpen(true);
  }

  function pickBuildingForPlot(bid: BuildingId) {
    if (selectedPlotIdx === null) return;
    audio.click();
    // Assign building to plot
    setPlotAssignments((prev) => {
      const next = [...prev];
      next[selectedPlotIdx] = bid;
      return next;
    });
    setCurrentBuildingId(bid);
    setSuggestionsOpen(false);
    setChosenIdx(null);
    setBuildStage(0);
    setConstructionProgress(0);
    setPhase('chapter-intro');
  }

  function handleChoose(idx: number) {
    if (!currentScenario) return;
    audio.unlock();
    const opt = currentScenario.options[idx];
    const otabekIdx = idx === 0 ? 1 : 0;
    const otabekOpt = currentScenario.options[otabekIdx];

    setBudget((b) => b - opt.cost);
    setIntegrity((v) => Math.max(0, Math.min(100, v + opt.integrityChange)));

    if (opt.isCorrupt && opt.personalBonus) {
      setPersonalEarnings((v) => v + opt.personalBonus!);
      setCoinTrigger((c) => c + 1);
      audio.coin();
    }

    // Mirror to Otabek (opposite choice — same scenario, opposite path)
    setOtabekBudget((b) => b - otabekOpt.cost);
    setOtabekIntegrity((v) => Math.max(0, Math.min(100, v + otabekOpt.integrityChange)));
    setOtabekBuildings((prev) => ({
      ...prev,
      [currentScenario.buildingId]: { status: 'alo', isFragile: otabekOpt.isCorrupt },
    }));
    if (otabekOpt.isCorrupt && otabekOpt.personalBonus) {
      setOtabekEarnings((v) => v + otabekOpt.personalBonus!);
    }

    setHistory((h) => [
      ...h,
      {
        round: currentScenario.id,
        buildingName: BUILDING_NAME[currentScenario.buildingId],
        isCorrupt: opt.isCorrupt,
        bonus: opt.isCorrupt ? opt.personalBonus ?? 0 : 0,
      },
    ]);
    setChosenIdx(idx);
    setPhase('reaction');
  }

  function continueAfterReaction() {
    if (!currentScenario || chosenIdx === null) return;
    const opt = currentScenario.options[chosenIdx];
    setBuildings((prev) => ({
      ...prev,
      [currentScenario.buildingId]: { status: 'qurilyapti', isFragile: opt.isCorrupt },
    }));
    setConstructionProgress(0);
    setBuildStage(0);
    setPhase('building');
  }

  // ── Interactive tap-to-build ──────────────────────────────────────────────
  // Player taps "QURISH" 3 times. Each tap advances buildStage and triggers SFX.
  // After stage 3 → set status to 'alo', play reward + voice, advance to celebration.
  function tapBuild() {
    if (phase !== 'building' || !currentScenario || chosenIdx === null) return;
    const next = buildStage + 1;
    setBuildStage(next);
    // Sync the progress bar
    setConstructionProgress(next / 3);
    audio.hammer();
    setTimeout(() => audio.drill(), 80);

    if (next >= 3) {
      // Construction complete!
      const opt = currentScenario.options[chosenIdx];
      const bid = currentScenario.buildingId;
      setTimeout(() => {
        setBuildings((prev) => ({
          ...prev,
          [bid]: { status: 'alo', isFragile: opt.isCorrupt },
        }));
        audio.buildComplete();
        setTimeout(() => audio.speak(BUILD_COMPLETE_VOICE[bid]), 380);
        setPhase('celebration');
      }, 700);
    }
  }

  // CELEBRATION → if honest, go to blessing; else advance
  useEffect(() => {
    if (phase !== 'celebration') return;
    const t = window.setTimeout(() => {
      if (
        currentScenario &&
        chosenIdx !== null &&
        !currentScenario.options[chosenIdx].isCorrupt
      ) {
        // Honest choice — citizens come bless + bonus money
        const bid = currentScenario.buildingId;
        const bonus = BLESSINGS[bid].bonus;
        setBudget((b) => b + bonus);
        setIntegrity((v) => Math.min(100, v + 3)); // small extra integrity boost
        setBonusTrigger((t) => t + 1);
        setPhase('blessing');
      } else {
        // Corrupt — straight to next round (no blessing)
        advanceRound();
      }
    }, CELEBRATION_MS);
    return () => window.clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  // TimePassesScene component handles its own 3-stage progression and calls
  // onDone (= setPhase('living-city')) when all stages complete

  // LIVING-CITY → also silently collapse Otabek's fragile, then route player
  useEffect(() => {
    if (phase !== 'living-city') return;
    const t = window.setTimeout(() => {
      // Time has passed — Otabek's fragile buildings collapse silently in his city
      const otabekFragile = (Object.entries(otabekBuildingsRef.current) as [BuildingId, BuildingState][])
        .filter(([, b]) => b.isFragile && b.status !== 'vayrona')
        .map(([id]) => id);
      if (otabekFragile.length > 0) {
        setOtabekBuildings((prev) => {
          const next = { ...prev };
          otabekFragile.forEach((id) => { next[id] = { status: 'vayrona', isFragile: false }; });
          return next;
        });
        setOtabekBudget((b) => Math.max(0, b - otabekFragile.length * 1200 - 600));
        setOtabekIntegrity((v) => Math.max(0, v - otabekFragile.length * 15));
      }

      const corruptIds = (Object.entries(buildingsRef.current) as [BuildingId, BuildingState][])
        .filter(([, b]) => b.isFragile && b.status !== 'vayrona')
        .map(([id]) => id);
      if (corruptIds.length === 0) {
        setPhase('game-over');
      } else {
        setReportQueue(corruptIds);
        setReportIndex(0);
        setPhase('incident-report');
      }
    }, 4000);
    return () => window.clearTimeout(t);
  }, [phase]);

  function continueAfterIncidentReport() {
    if (reportIndex + 1 >= reportQueue.length) {
      // All reports shown — trigger the big disaster
      triggerFinalDisaster();
    } else {
      setReportIndex((i) => i + 1);
    }
  }

  function triggerFinalDisaster() {
    const type: DisasterType = Math.random() < 0.5 ? 'zilzila' : 'suv-toshqini';
    // ALL fragile buildings collapse in the big event
    const affectedIds = (Object.entries(buildingsRef.current) as [BuildingId, BuildingState][])
      .filter(([, b]) => b.isFragile && b.status !== 'vayrona')
      .map(([id]) => id);

    const cost = affectedIds.length * 1200 + 600;
    const integrityHit = affectedIds.length * 15;

    // First mark fragile buildings as 'qulamoqda' (actively collapsing)
    setBuildings((prev) => {
      const next = { ...prev };
      affectedIds.forEach((id) => { next[id] = { status: 'qulamoqda', isFragile: false }; });
      return next;
    });
    setBudget((b) => Math.max(0, b - cost));
    setIntegrity((v) => Math.max(0, v - integrityHit));
    setDisaster({
      type,
      affectedNames: affectedIds.map((id) => BUILDING_NAME[id]),
      cost,
    });
    setShakeKey((k) => k + 1);
    // Use the LAST corrupt scenario for AI Judge context
    const lastCorruptScenario = SCENARIOS.find((s) => affectedIds.includes(s.buildingId));
    setPendingScenarioForJudge(lastCorruptScenario ?? null);
    // Show buildings actively collapsing (no overlay) before the cinematic title overlay
    setPhase('collapsing');
  }

  // COLLAPSING → buildings visibly fall over 1.8s → become vayrona → cinematic
  useEffect(() => {
    if (phase !== 'collapsing') return;
    audio.disaster();

    // After 1.8s of collapse animation, change qulamoqda → vayrona (rubble appears)
    const tCollapseDone = window.setTimeout(() => {
      setBuildings((prev) => {
        const next = { ...prev };
        (Object.keys(next) as BuildingId[]).forEach((id) => {
          if (next[id].status === 'qulamoqda') {
            next[id] = { status: 'vayrona', isFragile: false };
          }
        });
        return next;
      });
    }, 1800);

    // After 2.5s total, advance to disaster cinematic title overlay
    const tCinematic = window.setTimeout(() => setPhase('disaster-cinematic'), 2500);

    return () => {
      window.clearTimeout(tCollapseDone);
      window.clearTimeout(tCinematic);
    };
  }, [phase]);

  function continueAfterDisasterCinematic() { setPhase('disaster-modal'); }

  async function continueAfterDisasterModal() {
    setDisaster(null);
    if (pendingScenarioForJudge) {
      setPhase('ai-judge');
      setAiLoading(true); setAiQuestions([]);
      const qs = await askAIJudge(pendingScenarioForJudge);
      setAiQuestions(qs); setAiLoading(false);
    } else {
      advanceRound();
    }
  }

  function continueAfterJudge() {
    setPendingScenarioForJudge(null);
    setPhase('game-over');
  }

  function advanceRound() {
    const occupied = plotAssignments.filter(Boolean).length;
    if (occupied >= ALL_BUILDING_IDS.length) {
      // All plots placed — let the city LIVE for a while, then check consequences
      setPhase('time-passes');
    } else {
      // After every building, ask if player wants to continue or let years pass
      setPhase('continue-prompt');
    }
  }

  function continueBuilding() {
    audio.click();
    setSelectedPlotIdx(null);
    setCurrentBuildingId(null);
    setChosenIdx(null);
    setConstructionProgress(0);
    setBuildStage(0);
    setPhase('idle');
  }

  function stopBuilding() {
    audio.click();
    setPhase('time-passes');
  }

  function toggleMute() {
    const next = audio.toggleMute();
    setMuted(next);
  }

  return (
    <div
      className="sky-bg relative min-h-screen overflow-hidden"
      style={{
        '--sky-top': sky.top, '--sky-mid': sky.mid, '--sky-bot': sky.bot,
      } as React.CSSProperties}
    >
      {displayIntegrity < 50 && (
        <div className="pointer-events-none fixed inset-0 z-0 opacity-40"
          style={{
            background:
              'radial-gradient(circle at 20% 30%, rgba(0,0,0,0.45) 0%, transparent 40%), radial-gradient(circle at 80% 60%, rgba(80,40,20,0.4) 0%, transparent 50%)',
          }} />
      )}

      <motion.div
        className="pointer-events-none fixed right-8 top-24 z-0 text-5xl sm:right-16 sm:top-28 sm:text-6xl"
        animate={{ y: [0, -6, 0] }}
        transition={{ repeat: Infinity, duration: 6, ease: 'easeInOut' }}
      >
        {displayIntegrity >= 50 ? '☀️' : '🌫️'}
      </motion.div>

      {!introDone && (
        <IntroCinematic onDone={() => setIntroDone(true)} />
      )}

      {phase === 'start' ? (
        <StartScreen onStart={startGame} />
      ) : phase === 'game-over' ? (
        <>
          <HUD
            budget={budget} integrity={integrity}
            round={SCENARIOS.length} totalRounds={SCENARIOS.length}
            onVisitFriend={() => setFriendPickerOpen(true)}
            visitingFriend={visitingFriend}
            onBackHome={() => setVisitingFriend(null)}
            muted={muted} onToggleMute={toggleMute}
          />
          <div className="fixed inset-0 z-0">
            <Scene3D
              plots={visitingFriend ? friendPlots : playerPlots}
              constructingPlotIdx={null}
              buildStage={3}
              shakeKey={shakeKey}
              skyColor={{ top: sky.top, bot: sky.bot }}
              integrity={visitingFriend ? visitingFriend.integrity : integrity}
            />
          </div>
          <GameOverScreen
            buildings={buildings} history={history}
            budget={budget} integrity={integrity}
            personalEarnings={personalEarnings}
            onRestart={startGame}
            otabekBuildings={otabekBuildings}
            otabekIntegrity={otabekIntegrity}
            otabekBudget={otabekBudget}
            otabekEarnings={otabekEarnings}
          />
        </>
      ) : (
        <>
          <HUD
            budget={displayBudget} integrity={displayIntegrity}
            round={builtCount} totalRounds={3}
            onVisitFriend={() => setFriendPickerOpen(true)}
            visitingFriend={visitingFriend}
            onBackHome={() => setVisitingFriend(null)}
            hidden={phase === 'chapter-intro' || phase === 'disaster-cinematic' || phase === 'collapsing'}
            muted={muted} onToggleMute={toggleMute}
          />

          {/* 3D city — full screen background */}
          <div className="fixed inset-0 z-0">
            <Scene3D
              plots={displayPlots}
              constructingPlotIdx={constructingPlotIdx}
              buildStage={buildStage}
              shakeKey={shakeKey}
              skyColor={{ top: sky.top, bot: sky.bot }}
              integrity={visitingFriend ? visitingFriend.integrity : displayIntegrity}
              onPlotClick={phase === 'idle' && !visitingFriend ? handlePlotClick : undefined}
            />
          </div>

          {/* Idle hint — invite the player to click a plot */}
          {phase === 'idle' && !visitingFriend && !suggestionsOpen && (
            <motion.div
              initial={{ y: 30, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              className="pointer-events-none fixed inset-x-0 bottom-8 z-20 flex justify-center px-3"
            >
              <div className="rounded-2xl border-2 border-yellow-400/40 bg-slate-950/85 px-5 py-3 shadow-2xl backdrop-blur">
                <div className="text-[10px] font-bold uppercase tracking-[0.3em] text-yellow-300">
                  Shahringiz · {builtCount}/{ALL_BUILDING_IDS.length} bino qurildi
                </div>
                <div className="text-base font-extrabold text-white sm:text-lg">
                  📍 Bo'sh joyni tanlang — nima qurmoqchisiz?
                </div>
                <div className="text-xs text-white/65">
                  Sariq «+» belgisini bosing, taklifingiz bo'lishi mumkin
                </div>
              </div>
            </motion.div>
          )}

          <AIJudgeSprite />

          <AnimatePresence>
            {visitingFriend && <FriendBanner key="banner" friend={visitingFriend} />}
          </AnimatePresence>

          <CoinBurst trigger={coinTrigger} />

          <AnimatePresence>
            {phase === 'building' && currentScenario && !visitingFriend && (
              <BuildButton
                key="bb"
                buildingId={currentScenario.buildingId}
                buildStage={buildStage}
                onTap={tapBuild}
              />
            )}
            {phase === 'celebration' && currentScenario && chosenIdx !== null && !visitingFriend && (
              <CompletionBanner
                key="cmpl"
                buildingId={currentScenario.buildingId}
                isCorrupt={currentScenario.options[chosenIdx].isCorrupt}
              />
            )}
            {phase === 'blessing' && currentScenario && !visitingFriend && (
              <CitizenBlessing
                key={`bless-${currentScenario.buildingId}`}
                buildingId={currentScenario.buildingId}
                onComplete={advanceRound}
              />
            )}
            {phase === 'continue-prompt' && !visitingFriend && (
              <ContinuePrompt
                key="continue-prompt"
                builtCount={builtCount}
                total={ALL_BUILDING_IDS.length}
                onContinue={continueBuilding}
                onStop={stopBuilding}
              />
            )}
          </AnimatePresence>

          <BonusCoinBurst trigger={bonusTrigger} />

          <AnimatePresence mode="wait">
            {!visitingFriend && phase === 'chapter-intro' && currentScenario && (
              <ChapterIntro
                key={`intro-${currentBuildingId}`}
                scenario={currentScenario}
                onDone={() => setPhase('pitch')}
              />
            )}
            {!visitingFriend && (phase === 'pitch' || phase === 'reaction') && currentScenario && (
              <PitchScene
                key={`pitch-${currentBuildingId}-${phase}`}
                scenario={currentScenario}
                step={phase === 'pitch' ? 'pitch' : 'reaction'}
                chosenIdx={chosenIdx}
                onChoose={handleChoose}
                onContinue={continueAfterReaction}
              />
            )}
            {phase === 'time-passes' && (
              <TimePassesScene key="tp" onDone={() => setPhase('living-city')} />
            )}
            {phase === 'living-city' && (
              <LivingCityOverlay key="lc" onDone={() => { /* handled by effect */ }} />
            )}
            {phase === 'incident-report' && reportQueue[reportIndex] && (
              <IncidentReportScene
                key={`report-${reportIndex}`}
                report={INCIDENT_REPORTS[reportQueue[reportIndex]]}
                current={reportIndex}
                total={reportQueue.length}
                onContinue={continueAfterIncidentReport}
              />
            )}
            {phase === 'disaster-cinematic' && disaster && (
              <DisasterCinematic
                key={`dc-${shakeKey}`}
                type={disaster.type}
                onDone={continueAfterDisasterCinematic}
              />
            )}
            {phase === 'disaster-modal' && disaster && (
              <DisasterModal
                key={`dm-${shakeKey}`}
                type={disaster.type}
                affectedNames={disaster.affectedNames}
                budgetLoss={disaster.cost}
                onContinue={continueAfterDisasterModal}
              />
            )}
            {phase === 'ai-judge' && (
              <AIJudgeModal
                key="ai"
                loading={aiLoading} questions={aiQuestions}
                onAck={continueAfterJudge}
              />
            )}
          </AnimatePresence>

          <AnimatePresence>
            {suggestionsOpen && selectedPlotIdx !== null && !visitingFriend && (
              <SuggestionsPanel
                key="sugg"
                plotIdx={selectedPlotIdx}
                builtIds={builtBuildingIds}
                onPick={pickBuildingForPlot}
                onClose={() => { setSuggestionsOpen(false); setSelectedPlotIdx(null); }}
              />
            )}
          </AnimatePresence>

          <AnimatePresence>
            {friendPickerOpen && (
              <FriendPicker
                key="picker"
                friends={FRIENDS}
                onPick={(f) => { setVisitingFriend(f); setFriendPickerOpen(false); }}
                onClose={() => setFriendPickerOpen(false)}
              />
            )}
          </AnimatePresence>
        </>
      )}
    </div>
  );
}
