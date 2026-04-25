import { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronRight,
  ArrowLeft,
  RotateCcw,
  BookOpen,
  Heart,
  X,
  Volume2,
  VolumeX,
  Shield,
} from 'lucide-react';
import { audio, TypewriterLine } from './App';

// ============================================================================
//  TYPES + DATA
// ============================================================================

interface LifeNPC {
  name: string;
  role: string;
  emoji: string;
  bg: string; // tailwind gradient
  voiceLine?: string;
}

interface LifeOption {
  text: string;
  isHonest: boolean;
  reaction: string;
  consequence: string;
  consequenceEmoji: string;
}

interface LifeScenario {
  id: number;
  chapterEmoji: string;
  title: string;
  setting: string;
  npc: LifeNPC;
  pitch: string;
  options: [LifeOption, LifeOption];
  decisionObject: { emoji: string; label: string; instruction: string };
}

interface LifeChoice {
  scenarioId: number;
  scenarioTitle: string;
  isHonest: boolean;
  consequence: string;
  consequenceEmoji: string;
}

const LIFE_NPCS: Record<string, LifeNPC> = {
  bobur: {
    name: 'Bobur',
    role: 'Sinfdoshingiz',
    emoji: '🧒',
    bg: 'from-sky-700 via-blue-800 to-indigo-950',
    voiceLine: "Iltimos Akbar, yordam ber og'ayni!",
  },
  onangiz: {
    name: 'Onangiz',
    role: 'Ona',
    emoji: '👩‍🦰',
    bg: 'from-amber-700 via-orange-800 to-amber-950',
    voiceLine: "Akbar o'g'lim, men sen uchun qildim.",
  },
  otangiz: {
    name: 'Otangiz',
    role: 'Ota',
    emoji: '👨‍🦳',
    bg: 'from-stone-700 via-zinc-800 to-stone-950',
    voiceLine: "O'g'lim, tashvishlanma.",
  },
  jasur: {
    name: 'Jasur',
    role: 'Sinfdosh',
    emoji: '👦',
    bg: 'from-emerald-700 via-teal-800 to-slate-950',
    voiceLine: "Akbar, indama iltimos og'ayni.",
  },
  sotuvchi: {
    name: 'Karim aka',
    role: "Ko'cha sotuvchisi",
    emoji: '🧔',
    bg: 'from-emerald-800 via-green-800 to-stone-950',
    voiceLine: "Arzonroq qilaman, lekin chek yo'q.",
  },
};

const LIFE_SCENARIOS: LifeScenario[] = [
  {
    id: 1,
    chapterEmoji: '📝',
    title: 'Imtihon kuni',
    setting: '6-sinf matematika imtihoni. Sinf jim. Ovoz faqat qalamlar shovqini.',
    npc: LIFE_NPCS.bobur,
    decisionObject: {
      emoji: '📄',
      label: "Imtihon javobingiz",
      instruction: "Javob qog'ozini sudraysiz",
    },
    pitch:
      "Akbar og'ayni... 4-savolni hech qanday yo'l bilan yecha olmayapman. Sen aqllisan, bilasanku javobini. Iltimos sekin ko'rsat — hech kim ko'rmaydi. Do'stlik uchun, a? Men keyin senga keksdan beraman.",
    options: [
      {
        text:
          "Bobur, kechir, men yordam berolmayman. Imtihondan keyin uyimda birga tayyorlanamiz. Lekin hozir yo'q — bu yolg'on bo'lardi.",
        isHonest: true,
        reaction:
          "Bobur xafa bo'lib qaradi, lekin imtihondan chiqayotganda dedi: «Bilasanmi, sen to'g'ri qilding aslida. Men har doim ko'chirib qutula olmayman.»",
        consequence:
          "Bobur imtihondan 4 oldi. Siz birga tayyorlandingiz. Keyingi imtihonda u 5 oldi — birinchi marta o'zi yechib. Bobur endi sizni «haqiqiy do'st» deydi.",
        consequenceEmoji: '🤝',
      },
      {
        text: "Sekin javobni yashirib uzating.",
        isHonest: false,
        reaction:
          "Bobur tezda ko'chirdi va kulib qaradi: «Rahmat og'ayni, sen eng yaxshi do'stsan! Men sen uchun nima qilishim kerak?»",
        consequence:
          "Bobur 5 oldi. Lekin keyingi haftalarda har imtihonda javob so'ray boshladi. Sinfda «Akbar ko'chirib beradi» degan gap tarqaldi. Endi 5 nafar bola sizdan kutadi va siz ulardan qutula olmaysiz.",
        consequenceEmoji: '😰',
      },
    ],
  },
  {
    id: 2,
    chapterEmoji: '🎁',
    title: "Yangi yil sovg'asi",
    setting: "Uyda. Yangi yil oldidan. Onangiz qog'oz to'rvada nimadir tutib turibdi.",
    npc: LIFE_NPCS.onangiz,
    decisionObject: {
      emoji: '🎁',
      label: "Konvertli sovg'a",
      instruction: "Sovg'ani sudraysiz",
    },
    pitch:
      "Akbar o'g'lim, men sening o'qituvching xonim uchun sovg'a tayyorladim. Qarabuting — fransuz parfyumeri va ichida konvert. Ertaga olib boring. Men bilaman, u sizning baholaringizga «yaxshiroq qaraydi». Hammma shunday qiladi, o'g'lim. Bu odat.",
    options: [
      {
        text: "Onam, bu kerak emas. Men o'zim halol o'qiyman. Sovg'ani olmang iltimos — men o'qituvchi xonimga oddiy sharbat olib boraman.",
        isHonest: true,
        reaction:
          "Onangiz biroz xafa bo'ldi, lekin ovozini past qilib dedi: «Bilasanmi o'g'lim, men ham yaxshi narsa qilyapman demaganman aslida. Senga qiyin o'qishni istamasligim... lekin sen to'g'ri aytasan.»",
        consequence:
          "Sinfda Bobur, Madina onalari shunday sovg'a olib bordi va 5 oldi. Siz 4 oldingiz. Lekin yarim yildan keyin yangi o'qituvchi keldi va halol baholay boshladi. Endi siz haqiqiy 5 olasiz va onangiz sizdan faxrlanadi.",
        consequenceEmoji: '🌱',
      },
      {
        text: "Bo'pti onam, ko'taraman.",
        isHonest: false,
        reaction:
          "O'qituvchi xonim qovog'idan kuldi: «Onangizga rahmat ayt o'g'lim, ajoyib insonsiz.» Va keyingi haftada sizga eng yaxshi bahoni qo'ydi.",
        consequence:
          "5-baho keldi. Lekin sinfda Bobur va Madina sezdi. Tanaffus paytida sizga yondashib: «Konvertli o'quvchi» deb chaqira boshlashdi. Siz o'zingizni baholangiz uchun emas, otangizning puli uchun yaxshi deb his qila boshladingiz.",
        consequenceEmoji: '💔',
      },
    ],
  },
  {
    id: 3,
    chapterEmoji: '🏆',
    title: 'Olimpiada',
    setting: "Uyda kechki ovqat. Otangiz telefon bilan gaplashib bo'ldi va sizga qaradi.",
    npc: LIFE_NPCS.otangiz,
    decisionObject: {
      emoji: '📜',
      label: "Olimpiada sertifikati",
      instruction: "Sertifikatni sudraysiz",
    },
    pitch:
      "Akbar o'g'lim, men matematika olimpiadasi tashkilotchilaridan birini taniyman — eski do'stim. Unga aytsam, sen 1-o'rin sertifikatini olasan. Universitetga foydali. Hech kim sezmaydi. Sen aqllisan, baribir yutar eding — biz faqat «tezlashtirayapmiz».",
    options: [
      {
        text:
          "Yo'q dada. Agar men 1-o'rin bo'lsam, faqat o'zim tayyorlanganim uchun bo'lishim kerak. Bu yil tayyor emasman — keyingi yil qattiq tayyorlanaman.",
        isHonest: true,
        reaction:
          "Otangiz indamadi va ovqatini yedi. Keyin onangiz xonangizga kirib aytdi: «Otangiz qattiq xafa edi sening rad etishingdan. Lekin yotoqxonada o'tirib aytdi: ‹Qizim mendan ko'ra kuchliroq odam.›»",
        consequence:
          "U yil 5-o'rin oldingiz, sertifikat yo'q. Lekin keyingi yil o'zingiz 2-o'rin oldingiz. Universitetga halol kirdingiz. Otangiz har gal sizni boshqalarga ko'rsatib aytadi: «Mening o'g'lim hech kimning yordamisiz keldi.»",
        consequenceEmoji: '⭐',
      },
      {
        text: "Tushunarli dada, rahmat.",
        isHonest: false,
        reaction:
          "Otangiz quvonib: «Yaxshi o'g'il! Hayotda chinakam aqlli — fursatdan foydalanadi.» Bir hafta keyin sertifikat keldi. Sinfdagi 1-o'rin.",
        consequence:
          "Lekin universitetning birinchi mashqida professor: «Olimpiada g'olibi, javob bering» dedi. Hech narsa demadingiz. Sinfdoshlar kuldi. Endi har imtihonda otangizdan «yana yordam» so'rashga majbursiz. O'z aqlingizga ishonmaysiz.",
        consequenceEmoji: '😶',
      },
    ],
  },
  {
    id: 4,
    chapterEmoji: '🪟',
    title: 'Sinfdoshning siri',
    setting: 'Tanaffus. Koridor bo\'sh. Sinfning yangi oynasi sinib turibdi va Bobur qo\'lida to\'p.',
    npc: LIFE_NPCS.bobur,
    decisionObject: {
      emoji: '💬',
      label: "Sizning so'zingiz",
      instruction: "So'zlaringizni sudraysiz",
    },
    pitch:
      "Akbar, men oynani qasddan emas, tasodifan sindirdim. Hech kim ko'rmadi. Iltimos — agar so'rashsa, «bilmayman» degin. Otam meni urar agar bilsa. Sen mening eng yaqin do'stimsan, a?",
    options: [
      {
        text:
          "Bobur, men yolg'on aytishni xohlamayman. Sen tan olishing kerak. Men sen bilan o'qituvchining oldiga boraman, birga tushuntiramiz — tasodifan bo'ldi.",
        isHonest: true,
        reaction:
          "Bobur dastlab yig'ladi: «Sen ham endi do'stligimni qadrlamaysan!» Lekin keyin tan oldi. O'qituvchi xonim uni jazoladi, lekin tan olganligi uchun yengilroq. Otasi ham urgan emas — onasi: «Tan olganing yaxshi, o'g'lim» dedi.",
        consequence:
          "Bir hafta keyin Bobur sizga keldi: «Bilasanmi, men senga qattiq xafa edim. Lekin endi tushunaman — sen meni yolg'ondan saqlading.» Endi u sizdan har qanday «yashirin yordam» so'ramaydi. Haqiqiy do'stlik bo'ldi.",
        consequenceEmoji: '💪',
      },
      {
        text: "Mayli, indamayman.",
        isHonest: false,
        reaction:
          "Bobur sizni quchoqladi: «Sen haqiqiy do'stsan! Men senga umrim bo'yi qarzdorman!»",
        consequence:
          "O'qituvchi xonim koridorga chiqib, gumondor bo'ldi. Bekzod yaqin edi, undan so'radi. Bekzod hech narsa qilmadi, lekin guvoh yo'q. Bekzodga 2-baho qo'yildi xulq-atvordan. Bobur endi sizdan har «yashirin gap»ni so'raydi: imtihon javobi, otasiga yolg'on, hamma narsa. Endi siz uning quli kabi.",
        consequenceEmoji: '⛓️',
      },
    ],
  },
  {
    id: 5,
    chapterEmoji: '🎧',
    title: 'Mahsulot va chek',
    setting: "Maktab oldida. Ko'chada sotuvchi qutida narsalar bilan turibdi.",
    npc: LIFE_NPCS.sotuvchi,
    decisionObject: {
      emoji: '💵',
      label: "Pulingiz (5000 so'm)",
      instruction: "Pulni sudraysiz",
    },
    pitch:
      "Hey yigit! Bu naushnik 5000 so'mga turadi do'konda — qara qanday yaxshi. Lekin men sizga 3000 so'mga sotaman. Faqat bitta shart — chek bermayman, soliq to'lamayman. Sizning cho'ntakka 2000 so'm tejaladi. Aytmaysiz hech kimga, to'g'rimi?",
    options: [
      {
        text: "Yo'q akangiz, men chek bilan olaman. Davlatga soliq to'lash — bizning maktabga, kasalxonalarga keladi. Rahmat, lekin keyingi do'kondan olaman.",
        isHonest: true,
        reaction:
          "Sotuvchi qovog'idan kulib: «Mayli yigit, baxt sizga.» Siz keyingi do'kondan 5000 so'mga oldingiz, chek bilan.",
        consequence:
          "Naushnik bir xil. Lekin onangizga aytdingiz va u quvondi: «Qizim, bu kichik narsa, lekin katta xulq. Soliq — bizning shahar uchun.» Endi siz biladigan narsa: kichik halollik kichik narsa emas.",
        consequenceEmoji: '🏛️',
      },
      {
        text: "Bo'pti akangiz, tushunaman.",
        isHonest: false,
        reaction:
          "Sotuvchi xursand: «Ofarin yigit, aqlli sotib oluvchi.» Naushnikni oldingiz, 2000 so'm tejadingiz.",
        consequence:
          "Onangizga ko'rsatdingiz. U tushundi va sekin dedi: «Akbar, bu naushnik soliq to'lanmagan. Davlat byudjeti — bizning maktab, kasalxona. Sotuvchi davlatdan o'g'irlamoqda — sen ham bunda ozgina sherik bo'lib qolding.» Birinchi marta his qildingiz: korrupsiya kichikdan boshlanadi.",
        consequenceEmoji: '🧊',
      },
    ],
  },
];

const PLAYER = {
  name: 'Akbar',
  age: 12,
  emoji: '👦',
  bg: 'from-blue-600 via-indigo-700 to-slate-900',
};

// ============================================================================
//  COMPONENTS
// ============================================================================

function LifeHUD({
  honesty, scenarioIdx, total, muted, onToggleMute, onExit,
}: {
  honesty: number;
  scenarioIdx: number;
  total: number;
  muted: boolean;
  onToggleMute: () => void;
  onExit: () => void;
}) {
  const honestyColor = honesty >= 70 ? '#34d399' : honesty >= 40 ? '#facc15' : '#f43f5e';
  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-30 px-3 pt-3 sm:px-6 sm:pt-5">
      <div className="pointer-events-auto mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/15 bg-black/45 px-3 py-2 backdrop-blur-md sm:px-5 sm:py-3">
        {/* Akbar avatar + name */}
        <div className="flex items-center gap-3">
          <div className={`relative h-12 w-12 overflow-hidden rounded-full border-2 border-yellow-400 bg-gradient-to-br ${PLAYER.bg} shadow-lg`}>
            <div className="absolute inset-0 flex items-center justify-center text-2xl">{PLAYER.emoji}</div>
          </div>
          <div className="leading-tight">
            <div className="text-[10px] uppercase tracking-[0.25em] text-yellow-300/80">
              Hayot rejimi
            </div>
            <div className="text-sm font-extrabold text-white">
              {PLAYER.name}, {PLAYER.age} yosh
            </div>
          </div>
        </div>

        {/* Halollik bar */}
        <div className="flex items-center gap-2">
          <Shield className="h-4 w-4 text-yellow-300" />
          <div className="text-[10px] uppercase tracking-wider text-yellow-300/80">Halollik</div>
          <div className="relative h-2 w-32 overflow-hidden rounded-full bg-white/10 sm:w-48">
            <motion.div
              className="absolute inset-y-0 left-0 rounded-full"
              style={{ background: honestyColor }}
              animate={{ width: `${Math.max(0, Math.min(100, honesty))}%` }}
              transition={{ duration: 0.8 }}
            />
          </div>
          <div className="font-mono text-sm font-extrabold text-white">{Math.round(honesty)}</div>
        </div>

        {/* Stage dots */}
        <div className="hidden items-center gap-1 sm:flex">
          {Array.from({ length: total }).map((_, i) => (
            <span
              key={i}
              className={`h-2 w-6 rounded-full transition-colors ${
                i < scenarioIdx ? 'bg-yellow-400' : i === scenarioIdx ? 'bg-yellow-400/40 animate-pulse' : 'bg-white/15'
              }`}
            />
          ))}
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={onToggleMute}
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/15 text-white backdrop-blur transition hover:bg-white/25"
          >
            {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
          </button>
          <button
            onClick={onExit}
            className="flex items-center gap-1.5 rounded-xl bg-white/15 px-3 py-2 text-xs font-bold text-white backdrop-blur transition hover:bg-white/25"
          >
            <ArrowLeft className="h-4 w-4" /> Menyu
          </button>
        </div>
      </div>
    </div>
  );
}

function LifeChapterIntro({ scenario, onDone }: { scenario: LifeScenario; onDone: () => void }) {
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;
  const firedRef = useRef(false);

  useEffect(() => {
    const t = setTimeout(() => {
      if (firedRef.current) return;
      firedRef.current = true;
      onDoneRef.current();
    }, 2400);
    return () => clearTimeout(t);
  }, []);

  function skip() {
    if (firedRef.current) return;
    firedRef.current = true;
    onDoneRef.current();
  }

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 cursor-pointer"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={skip}
    >
      <motion.div
        className="absolute inset-0 opacity-20"
        animate={{ backgroundPositionX: ['0%', '100%'] }}
        transition={{ repeat: Infinity, duration: 10, ease: 'linear' }}
        style={{ backgroundImage: 'repeating-linear-gradient(45deg, rgba(245,166,35,0.2) 0 12px, transparent 12px 32px)' }}
      />
      <motion.div
        initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -20, opacity: 0 }}
        className="relative z-10 px-4 text-center"
      >
        <motion.div
          className="text-yellow-300 text-xs sm:text-sm uppercase font-bold"
          style={{ letterSpacing: '0.5em' }}
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ repeat: Infinity, duration: 2 }}
        >
          DILEMMA {scenario.id} / {LIFE_SCENARIOS.length}
        </motion.div>
        <motion.div
          initial={{ scale: 1.2 }} animate={{ scale: 1 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="mt-3 text-5xl font-black text-white sm:text-7xl"
        >
          {scenario.title.toUpperCase()}
        </motion.div>
        <motion.div
          initial={{ scale: 0, rotate: -180 }} animate={{ scale: 1, rotate: 0 }}
          transition={{ delay: 0.6, type: 'spring' }}
          className="mt-2 text-7xl sm:text-8xl"
        >
          {scenario.chapterEmoji}
        </motion.div>
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          transition={{ delay: 1, duration: 0.6 }}
          className="mt-4 text-base italic text-white/70 sm:text-lg max-w-xl mx-auto"
        >
          {scenario.setting}
        </motion.div>
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 0.55 }}
          transition={{ delay: 1.6, duration: 0.6 }}
          className="mt-8 text-xs text-white/55"
        >
          Bosing yoki kuting...
        </motion.div>
      </motion.div>
    </motion.div>
  );
}

// ── DRAG DECISION — interactive pull mechanic ──────────────────────────────

function DragDecision({
  scenario, onDecide,
}: { scenario: LifeScenario; onDecide: (i: number) => void }) {
  const [committed, setCommitted] = useState<null | 0 | 1>(null);
  const [hoverSide, setHoverSide] = useState<null | 'left' | 'right'>(null);

  function commit(idx: 0 | 1) {
    if (committed !== null) return;
    setCommitted(idx);
    if (scenario.options[idx].isHonest) audio.coin();
    else audio.hammer();
    setTimeout(() => onDecide(idx), 700);
  }

  return (
    <div className="relative mt-3 h-72 w-full sm:h-80">
      {/* LEFT zone — Option A */}
      <motion.button
        type="button"
        onClick={() => commit(0)}
        animate={{
          scale: hoverSide === 'left' ? 1.06 : 1,
          opacity: committed === 1 ? 0.25 : 1,
          borderColor: hoverSide === 'left' ? 'rgba(52,211,153,0.85)' : 'rgba(255,255,255,0.18)',
          backgroundColor: hoverSide === 'left' ? 'rgba(52,211,153,0.18)' : 'rgba(255,255,255,0.06)',
        }}
        whileHover={{ scale: 1.03 }}
        className="absolute left-0 top-1/2 w-[40%] max-w-[260px] -translate-y-1/2 rounded-2xl border-2 p-3 text-left backdrop-blur transition-colors disabled:cursor-not-allowed sm:p-4"
        disabled={committed !== null}
      >
        <div className="mb-2 inline-flex h-8 w-8 items-center justify-center rounded-xl bg-yellow-400 text-base font-black text-slate-900 shadow">
          A
        </div>
        <div className="text-[12px] font-bold uppercase tracking-wider text-emerald-300/90">
          ← bu yoqqa sudrang
        </div>
        <div className="mt-1 text-[13px] font-semibold leading-snug text-white sm:text-sm">
          {scenario.options[0].text}
        </div>
      </motion.button>

      {/* RIGHT zone — Option B */}
      <motion.button
        type="button"
        onClick={() => commit(1)}
        animate={{
          scale: hoverSide === 'right' ? 1.06 : 1,
          opacity: committed === 0 ? 0.25 : 1,
          borderColor: hoverSide === 'right' ? 'rgba(244,63,94,0.85)' : 'rgba(255,255,255,0.18)',
          backgroundColor: hoverSide === 'right' ? 'rgba(244,63,94,0.18)' : 'rgba(255,255,255,0.06)',
        }}
        whileHover={{ scale: 1.03 }}
        className="absolute right-0 top-1/2 w-[40%] max-w-[260px] -translate-y-1/2 rounded-2xl border-2 p-3 text-left backdrop-blur transition-colors disabled:cursor-not-allowed sm:p-4"
        disabled={committed !== null}
      >
        <div className="mb-2 inline-flex h-8 w-8 items-center justify-center rounded-xl bg-yellow-400 text-base font-black text-slate-900 shadow">
          B
        </div>
        <div className="text-right text-[12px] font-bold uppercase tracking-wider text-rose-300/90">
          bu yoqqa sudrang →
        </div>
        <div className="mt-1 text-[13px] font-semibold leading-snug text-white sm:text-sm">
          {scenario.options[1].text}
        </div>
      </motion.button>

      {/* CENTER — draggable decision object */}
      <motion.div
        drag={committed === null ? 'x' : false}
        dragConstraints={{ left: -260, right: 260, top: 0, bottom: 0 }}
        dragElastic={0.2}
        dragMomentum={false}
        onDrag={(_, info) => {
          if (committed !== null) return;
          if (info.offset.x < -90) setHoverSide('left');
          else if (info.offset.x > 90) setHoverSide('right');
          else setHoverSide(null);
        }}
        onDragEnd={(_, info) => {
          if (committed !== null) return;
          if (info.offset.x < -160) commit(0);
          else if (info.offset.x > 160) commit(1);
          else setHoverSide(null);
        }}
        whileDrag={{ scale: 1.15 }}
        animate={
          committed !== null
            ? { x: committed === 0 ? -240 : 240, scale: 0.6, opacity: 0, transition: { duration: 0.6 } }
            : { x: 0, scale: 1, opacity: 1 }
        }
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 cursor-grab select-none active:cursor-grabbing"
        style={{ touchAction: 'none' }}
      >
        <div className="flex flex-col items-center gap-2">
          <motion.div
            animate={committed === null ? { y: [0, -6, 0] } : {}}
            transition={{ repeat: Infinity, duration: 2, ease: 'easeInOut' }}
            className="rounded-3xl border-2 border-yellow-400/50 bg-slate-950/80 px-5 py-3 text-6xl shadow-2xl backdrop-blur sm:text-7xl"
            style={{
              boxShadow: '0 0 24px rgba(245,166,35,0.35), 0 8px 20px rgba(0,0,0,0.5)',
            }}
          >
            {scenario.decisionObject.emoji}
          </motion.div>
          <div className="rounded-full border border-yellow-400/40 bg-slate-950/80 px-3 py-1 text-[11px] font-bold text-yellow-200 backdrop-blur sm:text-xs">
            {scenario.decisionObject.label}
          </div>
        </div>
      </motion.div>

      {/* Hint */}
      <div className="absolute -bottom-2 left-0 right-0 text-center text-[11px] font-medium text-white/55 sm:text-xs">
        {scenario.decisionObject.instruction} — yoki tomonni tanlang
      </div>
    </div>
  );
}

function LifePitchScene({
  scenario, step, chosenIdx, onChoose, onContinue,
}: {
  scenario: LifeScenario;
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

  return (
    <motion.div
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

      <div className="relative flex min-h-full items-end px-3 pb-4 pt-24 sm:items-center sm:px-8 sm:pb-8">
        <div className="mx-auto grid w-full max-w-6xl items-center gap-8 sm:grid-cols-[auto_1fr] sm:gap-12">
          {/* NPC portrait */}
          <motion.div
            className="relative shrink-0 flex justify-center sm:justify-start"
            animate={!textDone ? { y: [0, -3, 0] } : { y: 0 }}
            transition={{ repeat: !textDone ? Infinity : 0, duration: 1.6 }}
          >
            <div className="relative h-52 w-52 overflow-hidden rounded-full border-[6px] border-yellow-400/70 shadow-2xl sm:h-72 sm:w-72">
              <div className={`absolute inset-0 bg-gradient-to-br ${scenario.npc.bg}`} />
              <motion.div
                className="absolute inset-0 flex items-center justify-center"
                animate={!textDone ? { rotate: [-2, 2, -2], y: [0, -3, 0] } : {}}
                transition={{ repeat: !textDone ? Infinity : 0, duration: 0.55 }}
              >
                <span className="text-[7rem] leading-none drop-shadow-2xl sm:text-[9rem]">
                  {scenario.npc.emoji}
                </span>
              </motion.div>
              <div className="absolute inset-0 ring-1 ring-inset ring-white/10" />
            </div>
            <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-2xl border-2 border-yellow-400 bg-slate-950/95 px-4 py-2 text-center shadow-xl">
              <div className="text-base font-extrabold text-white">{scenario.npc.name}</div>
              <div className="text-[10px] uppercase tracking-[0.2em] text-yellow-300">{scenario.npc.role}</div>
            </div>
          </motion.div>

          <div className="min-w-0">
            <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-black/35 px-3 py-1 text-[10px] uppercase tracking-[0.25em] text-yellow-300/90 backdrop-blur">
              <span>Dilemma {scenario.id}/{LIFE_SCENARIOS.length}</span>
              <span className="text-white/50">·</span>
              <span>{scenario.title}</span>
              <span className="text-base">{scenario.chapterEmoji}</span>
            </div>

            {/* Speech bubble */}
            <div className="relative mb-5">
              <div className="rounded-3xl bg-white px-5 py-4 text-[15px] leading-relaxed text-slate-900 shadow-2xl sm:px-7 sm:py-6 sm:text-lg">
                <TypewriterLine text={text} speed={step === 'reaction' ? 20 : 18} onDone={() => setTextDone(true)} dark />
              </div>
              <div className="absolute -left-3 top-12 hidden h-0 w-0 border-y-[14px] border-r-[18px] border-y-transparent border-r-white sm:block" />
            </div>

            {step === 'pitch' ? (
              textDone ? (
                <DragDecision scenario={scenario} onDecide={onChoose} />
              ) : (
                <div className="text-xs text-white/40 italic mt-3">
                  Gapni tinglang...
                </div>
              )
            ) : (
              <div className="flex justify-end">
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
                  Oqibatni ko'rish <ChevronRight className="ml-0.5 inline h-5 w-5" />
                </motion.button>
              </div>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function LifeConsequenceCard({
  scenario, chosenIdx, onContinue,
}: {
  scenario: LifeScenario;
  chosenIdx: number;
  onContinue: () => void;
}) {
  const opt = scenario.options[chosenIdx];
  return (
    <motion.div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/85 p-4 backdrop-blur-md"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
    >
      <motion.div
        initial={{ scale: 0.7, y: 30 }} animate={{ scale: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 220, damping: 18 }}
        className={`w-full max-w-xl overflow-hidden rounded-3xl border-2 shadow-2xl ${
          opt.isHonest ? 'border-emerald-400/60 bg-gradient-to-br from-emerald-950 to-slate-900'
                       : 'border-rose-400/60 bg-gradient-to-br from-rose-950 to-slate-900'
        }`}
      >
        <div className={`px-4 py-2 text-xs font-extrabold uppercase tracking-[0.25em] text-white ${opt.isHonest ? 'bg-emerald-600' : 'bg-rose-600'}`}>
          <BookOpen className="mr-2 inline h-4 w-4" />
          Bir nechа kun keyin...
        </div>
        <div className="p-6">
          <motion.div
            initial={{ scale: 0 }} animate={{ scale: 1 }}
            transition={{ delay: 0.3, type: 'spring', stiffness: 200 }}
            className="mb-3 text-7xl text-center"
          >
            {opt.consequenceEmoji}
          </motion.div>
          <div className={`mb-3 text-center text-xs uppercase tracking-[0.3em] ${opt.isHonest ? 'text-emerald-300' : 'text-rose-300'}`}>
            {opt.isHonest ? 'Halol qaror' : 'Yengil yo\'l'}
          </div>
          <p className="text-base leading-relaxed text-white">{opt.consequence}</p>
          <button
            onClick={() => { audio.click(); onContinue(); }}
            className={`mt-5 w-full rounded-xl px-4 py-3 font-extrabold transition ${
              opt.isHonest
                ? 'bg-emerald-500 text-white hover:bg-emerald-400'
                : 'bg-rose-500 text-white hover:bg-rose-400'
            }`}
          >
            Davom etish <ChevronRight className="ml-0.5 inline h-5 w-5" />
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

function LifeSummary({
  honesty, choices, onRestart, onExit,
}: {
  honesty: number;
  choices: LifeChoice[];
  onRestart: () => void;
  onExit: () => void;
}) {
  const honestCount = choices.filter((c) => c.isHonest).length;

  let title = '';
  let body = '';
  let emoji = '🏆';
  let tone = '';
  let voicePhrase = '';
  if (honestCount >= 4) {
    title = 'Halol Akbar';
    emoji = '🌟';
    body = "Siz qiyin tanlovlar oldida ham halol qoldingiz. Bu — kuchli xarakter. 16 yoshda, 22 yoshda, 30 yoshda — siz bir xil kuchli odam bo'lasiz.";
    tone = 'border-emerald-400/50 from-emerald-500/20';
    voicePhrase = "Tabriklaymiz! Siz halol Akbar bo'ldingiz.";
  } else if (honestCount >= 2) {
    title = "O'zining yo'lini izlayotgan Akbar";
    emoji = '🌱';
    body = "Bir necha qiyin tanlovda yengil yo'lni tanladingiz. Bu — odatiy. Lekin har korrupsiya keyingi ikkitasini oson qiladi. Yana o'ynang, boshqa tanlov qiling.";
    tone = 'border-amber-400/50 from-amber-500/20';
    voicePhrase = "Yana o'ynab ko'ring, boshqa tanlovlar qiling.";
  } else {
    title = "Yengil yo'lni tanlagan Akbar";
    emoji = '⛓️';
    body = "Hozir kichik narsa ko'rinadi — imtihondan ko'chirish, sotuvchidan chek olmaslik. Lekin bu odatlar yiqilmaydi. 30 yoshda Akbar endi boshqa odam — pul olishni odat qilgan, vijdoni jim. Hayot rejimini yana o'ynang.";
    tone = 'border-rose-400/50 from-rose-500/20';
    voicePhrase = "Yana bir bor o'ynab ko'ring va boshqa tanlovlar qiling.";
  }

  useEffect(() => {
    if (honestCount >= 4) audio.victory();
    else if (honestCount <= 1) audio.defeat();
    else audio.buildComplete();
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
              <div className="text-xs uppercase tracking-widest text-white/60">Akbarning halollik daftari</div>
              <div className="text-3xl font-black text-white">{title}</div>
            </div>
          </div>
          <p className="text-base leading-relaxed text-white/90">{body}</p>

          <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-3">
            <div className="rounded-xl bg-black/30 p-3">
              <div className="text-xs uppercase tracking-widest text-white/60">🛡️ Halollik</div>
              <div className="mt-0.5 font-mono text-lg font-extrabold text-white">{Math.round(honesty)}/100</div>
            </div>
            <div className="rounded-xl bg-emerald-500/10 px-3 py-2 text-emerald-300">
              ✅ Halol: <b>{honestCount}/{LIFE_SCENARIOS.length}</b>
            </div>
            <div className="rounded-xl bg-rose-500/10 px-3 py-2 text-rose-300">
              ❌ Yengil yo'l: <b>{LIFE_SCENARIOS.length - honestCount}</b>
            </div>
          </div>
        </div>

        <div className="border-t border-white/10 bg-black/25 p-5">
          <div className="mb-2 text-xs font-bold uppercase tracking-wider text-yellow-300/80">
            Sizning qarorlaringiz
          </div>
          <ul className="space-y-2 text-sm">
            {choices.map((c) => (
              <li
                key={c.scenarioId}
                className={`rounded-xl border px-3 py-3 ${
                  c.isHonest
                    ? 'border-emerald-400/30 bg-emerald-500/5'
                    : 'border-rose-400/30 bg-rose-500/5'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{c.consequenceEmoji}</span>
                    <span className="font-bold text-white">
                      <span className="mr-2 text-white/50">#{c.scenarioId}</span>
                      {c.scenarioTitle}
                    </span>
                  </div>
                  <span className={`text-xs font-bold uppercase ${c.isHonest ? 'text-emerald-300' : 'text-rose-300'}`}>
                    {c.isHonest ? 'Halol' : "Yengil yo'l"}
                  </span>
                </div>
                <div className="mt-2 text-xs leading-relaxed text-white/75">{c.consequence}</div>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <motion.button
          whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
          onClick={() => { audio.click(); onRestart(); }}
          className="flex items-center justify-center gap-2 rounded-2xl bg-yellow-400 px-6 py-4 font-black text-slate-900 transition hover:bg-yellow-300"
        >
          <RotateCcw className="h-5 w-5" /> Yana o'ynash
        </motion.button>
        <motion.button
          whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
          onClick={() => { audio.click(); onExit(); }}
          className="flex items-center justify-center gap-2 rounded-2xl bg-white/10 px-6 py-4 font-black text-white transition hover:bg-white/20"
        >
          <ArrowLeft className="h-5 w-5" /> Asosiy menyu
        </motion.button>
      </div>
    </motion.div>
  );
}

// ============================================================================
//  MAIN LIFE MODE
// ============================================================================

type LifePhase = 'chapter' | 'pitch' | 'reaction' | 'consequence' | 'summary';

export function LifeMode({ onExit }: { onExit: () => void }) {
  const [scenarioIdx, setScenarioIdx] = useState(0);
  const [phase, setPhase] = useState<LifePhase>('chapter');
  const [chosenIdx, setChosenIdx] = useState<number | null>(null);
  const [honesty, setHonesty] = useState(50);
  const [choices, setChoices] = useState<LifeChoice[]>([]);
  const [muted, setMuted] = useState(false);

  const scenario = LIFE_SCENARIOS[scenarioIdx];

  function handleChoose(idx: number) {
    if (!scenario) return;
    const opt = scenario.options[idx];
    setChosenIdx(idx);
    setHonesty((h) => Math.max(0, Math.min(100, h + (opt.isHonest ? 20 : -20))));
    if (opt.isHonest) audio.coin();
    else audio.hammer();
    if (scenario.npc.voiceLine) {
      setTimeout(() => audio.speak(scenario.npc.voiceLine!), 200);
    }
    setPhase('reaction');
  }

  function continueAfterReaction() {
    setPhase('consequence');
  }

  function continueAfterConsequence() {
    if (!scenario || chosenIdx === null) return;
    const opt = scenario.options[chosenIdx];
    setChoices((c) => [
      ...c,
      {
        scenarioId: scenario.id,
        scenarioTitle: scenario.title,
        isHonest: opt.isHonest,
        consequence: opt.consequence,
        consequenceEmoji: opt.consequenceEmoji,
      },
    ]);

    if (scenarioIdx + 1 >= LIFE_SCENARIOS.length) {
      setPhase('summary');
    } else {
      setScenarioIdx((i) => i + 1);
      setChosenIdx(null);
      setPhase('chapter');
    }
  }

  function restart() {
    setScenarioIdx(0);
    setPhase('chapter');
    setChosenIdx(null);
    setHonesty(50);
    setChoices([]);
  }

  function toggleMute() {
    const next = audio.toggleMute();
    setMuted(next);
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-950">
      {/* Soft animated background */}
      <div
        className="pointer-events-none fixed inset-0 z-0 opacity-30"
        style={{
          background:
            'radial-gradient(circle at 20% 30%, rgba(245,166,35,0.15), transparent 50%), radial-gradient(circle at 80% 70%, rgba(168,85,247,0.15), transparent 50%)',
        }}
      />

      {phase !== 'summary' && (
        <LifeHUD
          honesty={honesty}
          scenarioIdx={scenarioIdx}
          total={LIFE_SCENARIOS.length}
          muted={muted}
          onToggleMute={toggleMute}
          onExit={onExit}
        />
      )}

      {phase === 'chapter' && scenario && (
        <LifeChapterIntro
          key={`ch-${scenarioIdx}`}
          scenario={scenario}
          onDone={() => setPhase('pitch')}
        />
      )}
      {(phase === 'pitch' || phase === 'reaction') && scenario && (
        <LifePitchScene
          key={`pitch-${scenarioIdx}-${phase}`}
          scenario={scenario}
          step={phase === 'pitch' ? 'pitch' : 'reaction'}
          chosenIdx={chosenIdx}
          onChoose={handleChoose}
          onContinue={continueAfterReaction}
        />
      )}
      {phase === 'consequence' && scenario && chosenIdx !== null && (
        <LifeConsequenceCard
          key={`con-${scenarioIdx}`}
          scenario={scenario}
          chosenIdx={chosenIdx}
          onContinue={continueAfterConsequence}
        />
      )}

      {phase === 'summary' && (
        <LifeSummary
          honesty={honesty}
          choices={choices}
          onRestart={restart}
          onExit={onExit}
        />
      )}
    </div>
  );
}
