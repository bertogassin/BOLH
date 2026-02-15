import { createSignal, For, Show, Switch, Match, onMount, onCleanup, createEffect } from 'solid-js';
import { t, setLanguage, getLanguages, getCurrentLanguage, isRTL, currentLang } from '../i18n';
import { theme, setTheme, isDark, activeTheme } from '../theme';
import { departments, getDepartment, getDepartmentSkills, getSkillGroups, type Department, type SkillGroup } from '../departments';
import { getDailyLesson, lessonTypeLabel, levelLabel } from '../english_learn';
import { BlockchainScreen } from '../components';
import { askElina, addPersonality, createElinaContext, updateContext, type ElinaMessage, type ElinaContext, type ElinaAction } from '../elina';
import { toasts, dismissToast, showToast, notify, requestNotificationPermission, startDemoNotifications, unreadCount, type AppNotification } from '../notifications';
import { balance, frozenBalance, cards, transactions, escrows, deposit, withdraw, payForOrder, releaseEscrow, refundEscrow, addCard, removeCard, setDefaultCard, getStats, type PaymentCard, type Transaction } from '../payments';
import {
  tauriCoreInvoke,
  activeDepartment, setActiveDepartment,
  workerSkills, setWorkerSkills,
  verifiedDiplomas, setVerifiedDiplomas,
  workerStatus, setWorkerStatus,
  busyUntil, setBusyUntil,
  autoOnlineTime, setAutoOnlineTime,
  profileMode, setProfileMode,
  clientNeeds, setClientNeeds,
  homeMode, setHomeMode,
  homeExpandedDept, setHomeExpandedDept,
  homeExpandedGroup, setHomeExpandedGroup,
  homeExpandedSkill, setHomeExpandedSkill,
  getActiveDept,
  pinnedDepts, setPinnedDepts, togglePin,
  initLikes, getLikeCount, hasLiked, likeOnce,
  authUser, setAuthUser, saveAuth, clearAuth, loadAuth, isAuthenticated,
  type AuthUser,
} from '../store';
import { Icon, SkillIcon, Icons, EMOJI_TO_ICON, type NotifType } from '../ui';
import { LikeBadge, SwipeLayer, SwipeBack, playGlobalSound, haptic, hapticOrder, globalSoundEnabled, setGlobalSoundEnabled, globalHapticEnabled, setGlobalHapticEnabled, globalNotifSound, setGlobalNotifSound, globalVolume, setGlobalVolume, vibrationIntensity, setVibrationIntensity, rareEscalationEnabled, setRareEscalationEnabled } from '../ui';
import { MobileElina, ElinaChatPanel } from '../elina-ui';

export default function AcademyGamePage(props: { onBack: () => void }) {
  const [currentModule, setCurrentModule] = createSignal<string | null>(null);
  const [currentLevel, setCurrentLevel] = createSignal(0);
  const [score, setScore] = createSignal(0);
  const [streak, setStreak] = createSignal(0);
  const [showResult, setShowResult] = createSignal(false);
  const [lastAnswer, setLastAnswer] = createSignal<'correct' | 'wrong' | null>(null);
  const [selectedAnswer, setSelectedAnswer] = createSignal<number | null>(null);
  const [gameStarted, setGameStarted] = createSignal(false);
  const [lives, setLives] = createSignal(3);
  const [totalProgress, setTotalProgress] = createSignal(0);

  // Use global sound system
  const soundEnabled = globalSoundEnabled;
  const setSoundEnabled = setGlobalSoundEnabled;
  const playSound = (type: 'correct' | 'wrong' | 'levelup' | 'click') => {
    if (type === 'correct') playGlobalSound('success');
    else if (type === 'wrong') playGlobalSound('error');
    else if (type === 'levelup') playGlobalSound('levelup');
    else playGlobalSound('tap');
  };

  // Training modules
  // Training modules with difficulty levels (d: 1=easy, 2=medium, 3=hard)
  // SECTION 1: Professional department modules (9 departments)
  // SECTION 2: General safety modules (fire, first aid, rescue, hazmat, security, emergency, traffic)

  const professionalModules = [
    // ═══════ 1. PLUMBING ═══════
    {
      id: 'pro_plumbing',
      name: 'Сантехника: правила и стандарты',
      nameEn: 'Plumbing: Rules & Standards',
      icon: 'settings',
      color: 'from-blue-500 to-cyan-600',
      bgColor: 'bg-slate-100 dark:bg-black/70',
      description: 'ISO 21542, безопасность труб, водоснабжение',
      dept: 'plumbing',
      levels: [
        { title: 'Главный кран', question: 'Первое действие при аварии водоснабжения?', image: '🔧', options: ['Вызвать мастера', 'Перекрыть главный кран', 'Подставить ведро', 'Позвонить соседям'], correct: 1, explanation: 'Всегда перекрывайте главный кран! Это минимизирует ущерб.', titleEn: 'Main Valve', questionEn: 'First action during a water emergency?', optionsEn: ['Call a plumber', 'Shut off the main valve', 'Place a bucket', 'Call neighbors'], explanationEn: 'Always shut off the main valve! This minimizes damage.', d: 1 },
        { title: 'Давление воды', question: 'Нормальное давление воды в квартире?', image: '💧', options: ['0.5 бар', '1.5-4 бар', '8-10 бар', '15 бар'], correct: 1, explanation: 'Стандарт: 1.5-4 бар. Выше 6 бар нужен редуктор.', titleEn: 'Water Pressure', questionEn: 'Normal water pressure in an apartment?', optionsEn: ['0.5 bar', '1.5-4 bar', '8-10 bar', '15 bar'], explanationEn: 'Standard: 1.5-4 bar. Above 6 bar requires a pressure reducer.', d: 1 },
        { title: 'Сифон', question: 'Зачем нужен сифон под раковиной?', image: '🚰', options: ['Для красоты', 'Блокирует запах канализации', 'Для фильтрации', 'Для нагрева воды'], correct: 1, explanation: 'Водяной затвор в сифоне блокирует газы из канализации.', titleEn: 'Trap/Siphon', questionEn: 'Why is a trap needed under the sink?', optionsEn: ['For appearance', 'Blocks sewer gases', 'For filtration', 'To heat water'], explanationEn: 'The water seal in the trap blocks gases from the sewer.', d: 1 },
        { title: 'Тефлоновая лента', question: 'Как наматывать ФУМ-ленту на резьбу?', image: '🔩', options: ['Против резьбы', 'По ходу резьбы', 'Неважно', 'Крест-накрест'], correct: 1, explanation: 'По ходу резьбы (по часовой стрелке) — чтобы не разматывалась.', titleEn: 'PTFE Tape', questionEn: 'How to wrap PTFE tape on threads?', optionsEn: ['Against the thread', 'With the thread direction', 'Doesn\'t matter', 'Criss-cross'], explanationEn: 'With the thread direction (clockwise) — so it doesn\'t unravel.', d: 1 },
        { title: 'Температура воды', question: 'Безопасная температура горячей воды?', image: '🌡️', options: ['70°C', '60°C для хранения, 49°C на выходе', '30°C', '90°C'], correct: 1, explanation: '60°C убивает легионеллу, но на выходе крана ≤49°C чтобы не обжечь.', titleEn: 'Water Temperature', questionEn: 'Safe hot water temperature?', optionsEn: ['70°C', '60°C for storage, 49°C at outlet', '30°C', '90°C'], explanationEn: '60°C kills Legionella, but outlet must be ≤49°C to prevent scalding.', d: 2 },
        { title: 'Медные трубы', question: 'Почему нельзя соединять медь и сталь напрямую?', image: '🔗', options: ['Разный диаметр', 'Электрохимическая коррозия', 'Слишком дорого', 'Не держит давление'], correct: 1, explanation: 'Гальваническая коррозия разрушает стык. Нужен диэлектрик.', d: 2 },
        { title: 'Обратный клапан', question: 'Где обязателен обратный клапан?', image: '🔄', options: ['На холодной воде', 'На вводе водонагревателя', 'На сливе', 'Нигде'], correct: 1, explanation: 'Обратный клапан на бойлере предотвращает обратный поток горячей воды.', d: 2 },
        { title: 'Засор', question: 'Чем НЕЛЬЗЯ прочищать пластиковые трубы?', image: '🚿', options: ['Вантуз', 'Кислотные средства', 'Трос', 'Горячая вода'], correct: 1, explanation: 'Кислота может растворить пластик! Используйте щелочные средства.', d: 2 },
        { title: 'Уклон канализации', question: 'Минимальный уклон канализационной трубы 110мм?', image: '📐', options: ['0.5 см/м', '2 см/м', '5 см/м', '10 см/м'], correct: 1, explanation: 'Стандарт СНиП: 2 см на метр для трубы 110мм.', d: 2 },
        { title: 'Гидроудар', question: 'Что вызывает гидроудар?', image: '💥', options: ['Холодная вода', 'Резкое закрытие крана', 'Фильтр', 'Низкое давление'], correct: 1, explanation: 'Быстрое закрытие создаёт ударную волну. Решение — компенсатор.', d: 3 },
        { title: 'Легионелла', question: 'При какой температуре размножается легионелла?', image: '🦠', options: ['0-10°C', '20-45°C', '60-80°C', '90°C+'], correct: 1, explanation: 'Опасная зона 20-45°C. Бойлер держите на 60°C минимум.', d: 3 },
        { title: 'PPR трубы', question: 'Температура пайки полипропилена?', image: '🔥', options: ['100°C', '260°C', '400°C', '500°C'], correct: 1, explanation: '260°C — стандарт для пайки PPR труб. Перегрев сужает проход.', d: 3 },
      ]
    },
    // ═══════ 2. ELECTRICAL ═══════
    {
      id: 'pro_electrical',
      name: 'Электрика: безопасность и нормы',
      nameEn: 'Electrical: Safety & Codes',
      icon: 'zap',
      color: 'from-amber-500 to-yellow-600',
      bgColor: 'bg-amber-100',
      description: 'IEC, NEC стандарты, защита от тока',
      dept: 'electrical',
      levels: [
        { title: 'Смертельный ток', question: 'Какой ток опасен для жизни?', image: '⚡', options: ['10 А', '0.1 А (100 мА)', '5 А', '50 А'], correct: 1, explanation: '100 мА через сердце = фибрилляция. Даже 30 мА может убить.', titleEn: 'Lethal Current', questionEn: 'What current is dangerous to life?', optionsEn: ['10 A', '0.1 A (100 mA)', '5 A', '50 A'], explanationEn: '100 mA through the heart = fibrillation. Even 30 mA can be lethal.', d: 1 },
        { title: 'УЗО', question: 'Что такое УЗО/RCD и зачем?', image: '🔌', options: ['Счётчик', 'Защита от утечки тока', 'Усилитель', 'Выключатель'], correct: 1, explanation: 'RCD отключает при утечке 30 мА за 0.03 сек — спасает жизнь.', titleEn: 'RCD/GFCI', questionEn: 'What is an RCD and what is it for?', optionsEn: ['Meter', 'Protection from current leakage', 'Amplifier', 'Switch'], explanationEn: 'RCD trips on 30 mA leakage in 0.03 sec — saves lives.', d: 1 },
        { title: 'Заземление', question: 'Цвет провода заземления по МЭК?', image: '🔗', options: ['Красный', 'Жёлто-зелёный', 'Синий', 'Белый'], correct: 1, explanation: 'Жёлто-зелёный = земля (PE). Синий = нейтраль. Коричневый/чёрный = фаза.', titleEn: 'Grounding', questionEn: 'IEC ground wire color?', optionsEn: ['Red', 'Yellow-green', 'Blue', 'White'], explanationEn: 'Yellow-green = ground (PE). Blue = neutral. Brown/black = live.', d: 1 },
        { title: 'Автомат', question: 'Когда срабатывает автомат на 16А?', image: '🔧', options: ['Всегда', 'При перегрузке или КЗ', 'При низком напряжении', 'Никогда'], correct: 1, explanation: 'При перегрузке (тепловой расцеп.) и коротком замыкании (электромагн.).', titleEn: 'Circuit Breaker', questionEn: 'When does a 16A breaker trip?', optionsEn: ['Always', 'On overload or short circuit', 'On low voltage', 'Never'], explanationEn: 'On overload (thermal) and short circuit (electromagnetic).', d: 1 },
        { title: 'Сечение провода', question: 'Сечение кабеля для розеток 16А?', image: '📏', options: ['1.0 мм²', '1.5 мм²', '2.5 мм²', '4.0 мм²'], correct: 2, explanation: '2.5 мм² для розеток (16А). 1.5 мм² — для освещения (10А).', titleEn: 'Wire Gauge', questionEn: 'Cable cross-section for 16A outlets?', optionsEn: ['1.0 mm²', '1.5 mm²', '2.5 mm²', '4.0 mm²'], explanationEn: '2.5 mm² for outlets (16A). 1.5 mm² for lighting (10A).', d: 2 },
        { title: 'Дуга', question: 'Что вызывает электрическую дугу?', image: '🔥', options: ['Мокрые руки', 'Плохой контакт/зазор', 'Длинный кабель', 'Тёмное помещение'], correct: 1, explanation: 'Плохой контакт, окисление, ослабленный зажим = искра → пожар.', titleEn: 'Arc Flash', questionEn: 'What causes an electrical arc?', optionsEn: ['Wet hands', 'Poor contact/gap', 'Long cable', 'Dark room'], explanationEn: 'Poor contact, oxidation, loose terminal = spark → fire.', d: 2 },
        { title: 'Мокрые помещения', question: 'Класс защиты розетки в ванной?', image: '🚿', options: ['IP20', 'IP44', 'IP65', 'IP00'], correct: 1, explanation: 'IP44 минимум. Зона 0 (душ) — никаких розеток. Зона 2 — IP44+.', titleEn: 'Wet Rooms', questionEn: 'IP rating for bathroom outlet?', optionsEn: ['IP20', 'IP44', 'IP65', 'IP00'], explanationEn: 'IP44 minimum. Zone 0 (shower) — no outlets. Zone 2 — IP44+.', d: 2 },
        { title: 'LOTO', question: 'Что такое LOTO в электрике?', image: '🔒', options: ['Лотерея', 'Lockout/Tagout', 'Тип провода', 'Лампа'], correct: 1, explanation: 'Lock Out / Tag Out — блокировка и маркировка перед работой. Стандарт OSHA.', titleEn: 'LOTO', questionEn: 'What is LOTO in electrical work?', optionsEn: ['Lottery', 'Lockout/Tagout', 'Wire type', 'Lamp'], explanationEn: 'Lock Out / Tag Out — lock and tag before work. OSHA standard.', d: 2 },
        { title: 'Кондиционер линия', question: 'Нужна ли отдельная линия для кондиционера?', image: '❄️', options: ['Нет, любая розетка', 'Да, отдельный автомат', 'Через удлинитель', 'Через соседнюю розетку'], correct: 1, explanation: 'Кондиционер требует отдельную линию с автоматом и УЗО.', titleEn: 'AC Circuit', questionEn: 'Does an AC unit need a dedicated circuit?', optionsEn: ['No, any outlet', 'Yes, dedicated breaker', 'Via extension cord', 'From adjacent outlet'], explanationEn: 'AC requires a dedicated circuit with breaker and RCD.', d: 2 },
        { title: 'Электроожог', question: 'Первая помощь при электроожоге?', image: '🤕', options: ['Мазь', 'Отключить ток, CPR, 112', 'Вода', 'Растирание'], correct: 1, explanation: 'Отключить источник! Не трогать голыми руками. CPR при остановке сердца.', titleEn: 'Electric Shock', questionEn: 'First aid for electric shock?', optionsEn: ['Ointment', 'Cut power, CPR, 112', 'Water', 'Rub'], explanationEn: 'Cut power source! Don\'t touch with bare hands. CPR if cardiac arrest.', d: 3 },
        { title: 'Фаза на выключатель', question: 'Почему фазу ведут через выключатель?', image: '💡', options: ['Для экономии', 'Чтобы при выключении лампа была обесточена', 'Неважно', 'Для яркости'], correct: 1, explanation: 'Если нейтраль через выключатель — патрон под напряжением даже выключенный!', d: 3 },
        { title: 'Селективность', question: 'Что такое селективность автоматов?', image: '📊', options: ['Один автомат', 'Отключается только ближайший к аварии', 'Все отключаются', 'Дизайн щита'], correct: 1, explanation: 'При КЗ срабатывает только автомат на повреждённой линии, остальные работают.', titleEn: 'Selectivity', questionEn: 'What is breaker selectivity?', optionsEn: ['One breaker', 'Only the breaker nearest the fault trips', 'All trip', 'Panel design'], explanationEn: 'On short circuit only the faulted circuit\'s breaker trips, others stay on.', d: 3 },
      ]
    },
    // ═══════ 3. LOCKS & DOORS ═══════
    {
      id: 'pro_locks',
      name: 'Замки: безопасность и стандарты',
      nameEn: 'Locks: Security & Standards',
      icon: 'lock',
      color: 'from-slate-500 to-gray-700',
      bgColor: 'bg-slate-100',
      description: 'EN 12209, классы замков, методы вскрытия',
      dept: 'locks',
      levels: [
        { title: 'Типы замков', question: 'Какой замок самый надёжный для входной двери?', image: '🔐', options: ['Навесной', 'Сувальдный + цилиндровый', 'Щеколда', 'Электронный (только)'], correct: 1, explanation: 'Комбинация двух типов — сувальдный + цилиндровый — максимальная защита.', titleEn: 'Lock Types', questionEn: 'Which lock is most secure for an entry door?', optionsEn: ['Padlock', 'Lever tumbler + cylinder', 'Latch', 'Electronic only'], explanationEn: 'Combination of two types — lever tumbler + cylinder — maximum protection.', d: 1 },
        { title: 'Цилиндр', question: 'Что означает класс Euro Profile?', image: '🔑', options: ['Европейский дизайн', 'Стандартный размер цилиндра DIN', 'Дорогой замок', 'Электронный'], correct: 1, explanation: 'Euro Profile (DIN) — стандарт размера цилиндра, совместим со всеми замками.', titleEn: 'Cylinder', questionEn: 'What does Euro Profile class mean?', optionsEn: ['European design', 'Standard DIN cylinder size', 'Expensive lock', 'Electronic'], explanationEn: 'Euro Profile (DIN) — standard cylinder size, compatible with all locks.', d: 1 },
        { title: 'Броненакладка', question: 'Зачем нужна броненакладка?', image: '🛡️', options: ['Декор', 'Защита цилиндра от высверливания/выбивания', 'Звукоизоляция', 'От ржавчины'], correct: 1, explanation: 'Броненакладка из закалённой стали защищает от физического взлома.', titleEn: 'Cylinder Guard', questionEn: 'Why is a cylinder guard needed?', optionsEn: ['Decoration', 'Protects cylinder from drilling/bumping', 'Sound insulation', 'Rust prevention'], explanationEn: 'Reinforced plate of hardened steel protects against physical break-in.', d: 1 },
        { title: 'Бампинг', question: 'Что такое бампинг замка?', image: '🔨', options: ['Удар по двери', 'Вскрытие спецключом + удар', 'Сверление', 'Отмычка'], correct: 1, explanation: 'Bump key + удар выстраивает пины. Защита: антибампинговые цилиндры.', titleEn: 'Lock Bumping', questionEn: 'What is lock bumping?', optionsEn: ['Hitting the door', 'Special key + impact to align pins', 'Drilling', 'Picking'], explanationEn: 'Bump key + impact aligns pins. Protection: anti-bump cylinders.', d: 2 },
        { title: 'Класс безопасности', question: 'Сколько классов взломостойкости по EN 12209?', image: '📊', options: ['2', '3', '5', '7'], correct: 2, explanation: 'EN 12209: 5 классов (1-5). Класс 5 — максимальная взломостойкость.', d: 2 },
        { title: 'Мастер-система', question: 'Что такое мастер-система?', image: '🗝️', options: ['Один ключ открывает все', 'Много ключей к одному замку', 'Электронный замок', 'Кодовый замок'], correct: 0, explanation: 'Один мастер-ключ открывает все замки системы. Каждый свой — только свой.', titleEn: 'Master Key System', questionEn: 'What is a master key system?', optionsEn: ['One key opens all', 'Many keys to one lock', 'Electronic lock', 'Keypad lock'], explanationEn: 'One master key opens all locks in the system. Each user key opens only its lock.', d: 2 },
        { title: 'Дверная коробка', question: 'Главное слабое место — замок или коробка?', image: '🚪', options: ['Замок', 'Дверная коробка и притвор', 'Ключ', 'Ручка'], correct: 1, explanation: 'Чаще выбивают коробку. Усиленная стальная коробка + длинные анкера.', titleEn: 'Door Frame', questionEn: 'Main weak point — lock or frame?', optionsEn: ['Lock', 'Door frame and strike', 'Key', 'Handle'], explanationEn: 'Frames are kicked in most often. Reinforced steel frame + long anchors.', d: 2 },
        { title: 'Электронный замок', question: 'Питание электрозамка отключилось. Что произойдёт?', image: '🔋', options: ['Заблокируется навсегда', 'Зависит от типа: Fail-Safe или Fail-Secure', 'Откроется', 'Сирена'], correct: 1, explanation: 'Fail-Safe открывается (для эвакуации). Fail-Secure остаётся закрытым.', titleEn: 'Electric Lock', questionEn: 'Power failed on electric lock. What happens?', optionsEn: ['Locks permanently', 'Depends on type: Fail-Safe or Fail-Secure', 'Opens', 'Alarm'], explanationEn: 'Fail-Safe opens (for evacuation). Fail-Secure stays locked.', d: 3 },
        { title: 'Пожарные двери', question: 'Требование к замку пожарной двери?', image: '🔥', options: ['Максимальная защита', 'Открываться без ключа изнутри', 'Не иметь замка', 'Автоматический'], correct: 1, explanation: 'EN 179/1125: Panic exit — открытие нажатием/давлением без ключа!', titleEn: 'Fire Doors', questionEn: 'Requirement for fire door lock?', optionsEn: ['Maximum security', 'Open without key from inside', 'No lock allowed', 'Automatic'], explanationEn: 'EN 179/1125: Panic exit — opens by push/pressure without key!', d: 3 },
        { title: 'Anti-snap', question: 'Что такое anti-snap цилиндр?', image: '💪', options: ['Гибкий цилиндр', 'Ломается в безопасной точке, замок остаётся', 'Не ломается', 'Из пластика'], correct: 1, explanation: 'Anti-snap ломается в точке разлома, но ядро и замок остаются защищены.', d: 3 },
      ]
    },
    // ═══════ 4. TECH REPAIR ═══════
    {
      id: 'pro_tech',
      name: 'Ремонт техники: правила',
      nameEn: 'Tech Repair: Rules & Safety',
      icon: 'settings',
      color: 'from-violet-500 to-purple-700',
      bgColor: 'bg-slate-100 dark:bg-black/70',
      description: 'ESD защита, диагностика, стандарты',
      dept: 'tech',
      levels: [
        { title: 'ESD', question: 'Что такое ESD и почему опасно?', image: '⚡', options: ['Экран', 'Статический разряд — убивает микросхемы', 'Программа', 'Ошибка'], correct: 1, explanation: 'ESD: 20В убивает чип. Человек чувствует только от 3000В!', titleEn: 'ESD', questionEn: 'What is ESD and why is it dangerous?', optionsEn: ['Screen', 'Static discharge — kills microchips', 'Program', 'Error'], explanationEn: 'ESD: 20V kills a chip. Humans only feel from 3000V!', d: 1 },
        { title: 'Антистатика', question: 'Обязательное при ремонте ПК внутри?', image: '🖥️', options: ['Перчатки', 'Антистатический браслет', 'Шапка', 'Ботинки'], correct: 1, explanation: 'ESD-браслет заземляет вас и защищает компоненты.', titleEn: 'Antistatic', questionEn: 'Required when repairing PC internals?', optionsEn: ['Gloves', 'Antistatic wrist strap', 'Cap', 'Boots'], explanationEn: 'ESD wrist strap grounds you and protects components.', d: 1 },
        { title: 'Мультиметр', question: 'Чем измеряют напряжение?', image: '📊', options: ['Отвёрткой', 'Мультиметром', 'Термометром', 'Линейкой'], correct: 1, explanation: 'Мультиметр: напряжение, ток, сопротивление — основной инструмент.', titleEn: 'Multimeter', questionEn: 'What measures voltage?', optionsEn: ['Screwdriver', 'Multimeter', 'Thermometer', 'Ruler'], explanationEn: 'Multimeter: voltage, current, resistance — essential tool.', d: 1 },
        { title: 'Конденсатор', question: 'Чем опасен конденсатор в телевизоре/микроволновке?', image: '💥', options: ['Запахом', 'Хранит смертельный заряд даже выключенный', 'Весом', 'Температурой'], correct: 1, explanation: 'Конденсатор в СВЧ = до 4000В! Всегда разряжайте перед работой.', titleEn: 'Capacitor', questionEn: 'Why is a capacitor in a TV/microwave dangerous?', optionsEn: ['Smell', 'Holds lethal charge even when off', 'Weight', 'Temperature'], explanationEn: 'Capacitor in microwave = up to 4000V! Always discharge before work.', d: 2 },
        { title: 'Термопаста', question: 'Как часто менять термопасту на CPU?', image: '🌡️', options: ['Никогда', 'Каждый месяц', 'Раз в 2-3 года', 'Каждый день'], correct: 2, explanation: 'Каждые 2-3 года. Высохшая паста = перегрев = throttling.', titleEn: 'Thermal Paste', questionEn: 'How often to replace thermal paste on CPU?', optionsEn: ['Never', 'Every month', 'Every 2-3 years', 'Every day'], explanationEn: 'Every 2-3 years. Dried paste = overheating = throttling.', d: 2 },
        { title: 'Компрессор', question: 'Чем чистить пыль внутри ПК?', image: '💨', options: ['Пылесосом', 'Сжатым воздухом', 'Мокрой тряпкой', 'Феном'], correct: 1, explanation: 'Сжатый воздух! Пылесос создаёт статику. Фен — горячий воздух.', titleEn: 'Compressed Air', questionEn: 'How to clean dust inside a PC?', optionsEn: ['Vacuum', 'Compressed air', 'Wet cloth', 'Hair dryer'], explanationEn: 'Compressed air! Vacuum creates static. Hair dryer = hot air.', d: 1 },
        { title: 'BIOS reset', question: 'Как сбросить BIOS?', image: '🔧', options: ['Удалить файл', 'Вынуть батарейку CMOS', 'Переустановить ОС', 'Ударить'], correct: 1, explanation: 'Батарейка CR2032 + перемычка Clear CMOS на 10 секунд.', titleEn: 'BIOS Reset', questionEn: 'How to reset BIOS?', optionsEn: ['Delete file', 'Remove CMOS battery', 'Reinstall OS', 'Physical impact'], explanationEn: 'CR2032 battery + Clear CMOS jumper for 10 seconds.', d: 2 },
        { title: 'Правильная отвёртка', question: 'Почему важен правильный размер отвёртки?', image: '🔩', options: ['Скорость', 'Не сорвать шлиц/головку', 'Красота', 'Неважно'], correct: 1, explanation: 'Неподходящая отвёртка срывает шлиц. Потом болт не выкрутить!', titleEn: 'Correct Screwdriver', questionEn: 'Why is the correct screwdriver size important?', optionsEn: ['Speed', 'Avoid stripping the head', 'Appearance', 'Doesn\'t matter'], explanationEn: 'Wrong size strips the screw head. Then the bolt cannot be removed!', d: 1 },
        { title: 'Резервная копия', question: 'Правило 3-2-1 для бэкапов?', image: '💾', options: ['3 файла', '3 копии, 2 типа носителя, 1 вне здания', 'Раз в 3 дня', '3 диска'], correct: 1, explanation: '3 копии данных, на 2 типах носителей, 1 копия в другом месте.', d: 3 },
        { title: 'SSD vs HDD', question: 'Можно ли восстановить данные с SSD после TRIM?', image: '💿', options: ['Легко', 'Практически невозможно', 'Всегда', 'С программой'], correct: 1, explanation: 'TRIM обнуляет ячейки. Восстановление после TRIM почти невозможно!', d: 3 },
        { title: 'Пайка', question: 'Температура пайки электроники (бессвинцовый)?', image: '🔥', options: ['100°C', '250°C', '350-370°C', '500°C'], correct: 2, explanation: '350-370°C для бессвинцового припоя. Свинцовый: 300-320°C.', d: 3 },
      ]
    },
    // ═══════ 5. HANDYMAN ═══════
    {
      id: 'pro_handyman',
      name: 'Домашний мастер: стандарты',
      nameEn: 'Handyman: Standards & Skills',
      icon: 'settings',
      color: 'from-orange-500 to-red-600',
      bgColor: 'bg-slate-100 dark:bg-black/70',
      description: 'Инструменты, мебель, отделка, безопасность',
      dept: 'handyman',
      levels: [
        { title: 'Дюбель в бетон', question: 'Чем сверлить бетон?', image: '🔩', options: ['Обычным сверлом', 'Перфоратором с буром', 'Шуруповёртом', 'Отвёрткой'], correct: 1, explanation: 'Перфоратор (ударное сверление) + бур SDS. Дрель не справится.', titleEn: 'Concrete Anchor', questionEn: 'How to drill concrete?', optionsEn: ['Regular drill bit', 'Hammer drill with masonry bit', 'Screwdriver', 'Screwdriver bit'], explanationEn: 'Hammer drill (impact) + SDS masonry bit. Regular drill won\'t work.', d: 1 },
        { title: 'Уровень', question: 'Зачем проверять уровнем?', image: '📏', options: ['Для красоты', 'Горизонтальность и вертикальность', 'Измерить длину', 'Найти провода'], correct: 1, explanation: 'Строительный уровень/лазер — всё должно быть ровно!', titleEn: 'Level', questionEn: 'Why check with a level?', optionsEn: ['For looks', 'Horizontal and vertical alignment', 'Measure length', 'Find wires'], explanationEn: 'Spirit level/laser — everything must be level!', d: 1 },
        { title: 'Скрытая проводка', question: 'Как найти провод в стене?', image: '🔌', options: ['Наугад', 'Детектором скрытой проводки', 'По звуку', 'По температуре'], correct: 1, explanation: 'Детектор проводки обязателен! Просверлить провод = КЗ или удар током.', titleEn: 'Hidden Wiring', questionEn: 'How to locate wires in a wall?', optionsEn: ['Guess', 'Cable/wire detector', 'By sound', 'By temperature'], explanationEn: 'Cable detector is essential! Drilling into a wire = short circuit or electric shock.', d: 1 },
        { title: 'Гипсокартон нагрузка', question: 'Максимальная нагрузка на дюбель в гипсокартоне?', image: '📺', options: ['50 кг', '5-15 кг (обычный дюбель)', '100 кг', '1 кг'], correct: 1, explanation: '5-15 кг на дюбель-бабочку. Тяжёлое (ТВ) — только в профиль/стену за ГКЛ!', titleEn: 'Drywall Load', questionEn: 'Max load for anchor in drywall?', optionsEn: ['50 kg', '5-15 kg (toggle anchor)', '100 kg', '1 kg'], explanationEn: '5-15 kg per toggle anchor. Heavy items (TV) — only into stud or wall behind drywall!', d: 2 },
        { title: 'Герметик', question: 'Через сколько схватывается силиконовый герметик?', image: '🧴', options: ['Мгновенно', 'Поверхность: 20 мин, полностью: 24ч', '5 минут', '1 неделя'], correct: 1, explanation: 'Корка за 20 минут. Полная полимеризация — 24 часа. Не мочить!', titleEn: 'Silicone Sealant', questionEn: 'Silicone sealant cure time?', optionsEn: ['Instant', 'Skin: 20 min, fully cured: 24h', '5 minutes', '1 week'], explanationEn: 'Skin in 20 minutes. Full cure — 24 hours. Don\'t get wet!', d: 2 },
        { title: 'Типы дюбелей', question: 'Какой дюбель для пустотелого кирпича?', image: '🧱', options: ['Обычный пластиковый', 'Химический анкер или дюбель-бабочка', 'Деревянный', 'Без дюбеля'], correct: 1, explanation: 'Пустотелый кирпич: химический анкер или специальные распорные дюбели.', titleEn: 'Anchor Types', questionEn: 'Which anchor for hollow brick?', optionsEn: ['Regular plastic', 'Chemical anchor or toggle', 'Wooden', 'No anchor'], explanationEn: 'Hollow brick: chemical anchor or special toggle anchors.', d: 2 },
        { title: 'Ламинат зазор', question: 'Зазор ламината от стены?', image: '🏠', options: ['Впритык', '8-10 мм', '50 мм', '1 мм'], correct: 1, explanation: '8-10 мм — температурный зазор. Ламинат расширяется при нагреве!', titleEn: 'Laminate Gap', questionEn: 'Laminate expansion gap from wall?', optionsEn: ['Flush', '8-10 mm', '50 mm', '1 mm'], explanationEn: '8-10 mm — thermal expansion gap. Laminate expands when heated!', d: 2 },
        { title: 'Плиточный клей', question: 'Через сколько можно ходить по плитке?', image: '🧱', options: ['Сразу', 'Через 24-48 часов', 'Через 1 час', 'Через неделю'], correct: 1, explanation: '24-48 часов. Затирку швов — через 24 часа после укладки.', titleEn: 'Tile Adhesive', questionEn: 'When can you walk on newly laid tile?', optionsEn: ['Immediately', 'After 24-48 hours', 'After 1 hour', 'After a week'], explanationEn: '24-48 hours. Grout joints — 24 hours after laying.', d: 2 },
        { title: 'Мебель крепёж', question: 'Чем скрепить мебель из ЛДСП (IKEA-тип)?', image: '🪑', options: ['Гвоздями', 'Конфирмат (евровинт)', 'Клеем', 'Скотчем'], correct: 1, explanation: 'Конфирмат (6.4×50) — стандартный мебельный крепёж для ЛДСП.', titleEn: 'Furniture Fasteners', questionEn: 'How to join particleboard furniture (IKEA-type)?', optionsEn: ['Nails', 'Confirmat (euro screw)', 'Glue', 'Tape'], explanationEn: 'Confirmat (6.4×50) — standard furniture fastener for particleboard.', d: 1 },
        { title: 'Малярный скотч', question: 'Когда снимать малярный скотч?', image: '🎨', options: ['После высыхания', 'Пока краска влажная', 'Через неделю', 'Никогда'], correct: 1, explanation: 'Снимать пока краска не высохла полностью! Иначе отрывает вместе с краской.', titleEn: 'Painter\'s Tape', questionEn: 'When to remove painter\'s tape?', optionsEn: ['After paint dries', 'While paint is still wet', 'After a week', 'Never'], explanationEn: 'Remove before paint fully dries! Otherwise it tears the paint off.', d: 2 },
        { title: 'СИЗ', question: 'Обязательные СИЗ при работе с болгаркой?', image: '🥽', options: ['Ничего', 'Очки + перчатки + наушники', 'Только перчатки', 'Каска'], correct: 1, explanation: 'Защитные очки, перчатки, наушники. Волосы убрать! Искры = пожар.', titleEn: 'PPE', questionEn: 'Required PPE when using an angle grinder?', optionsEn: ['Nothing', 'Goggles + gloves + ear protection', 'Gloves only', 'Hard hat'], explanationEn: 'Safety goggles, gloves, ear protection. Tie back hair! Sparks = fire risk.', d: 1 },
      ]
    },
    // ═══════ 6. CLEANING ═══════
    {
      id: 'pro_cleaning',
      name: 'Клининг: стандарты чистоты',
      nameEn: 'Cleaning: Standards & Methods',
      icon: 'check',
      color: 'from-emerald-500 to-teal-600',
      bgColor: 'bg-emerald-100',
      description: 'ISO 14644, дезинфекция, химия, безопасность',
      dept: 'cleaning',
      levels: [
        { title: 'Направление уборки', question: 'Правильный порядок уборки помещения?', image: '🧹', options: ['От пола к потолку', 'Сверху вниз, от дальнего угла к выходу', 'Случайно', 'Только пол'], correct: 1, explanation: 'Сверху вниз — пыль падает. От дальнего угла — не наступать на чистое.', titleEn: 'Cleaning direction', questionEn: 'Correct order for cleaning a room?', optionsEn: ['From floor to ceiling', 'Top to bottom, from far corner to exit', 'Random', 'Floor only'], explanationEn: 'Top to bottom — dust falls down. From far corner — avoid stepping on clean areas.', d: 1 },
        { title: 'Микрофибра', question: 'Почему микрофибра лучше обычной тряпки?', image: '🧽', options: ['Дешевле', 'Собирает бактерии без химии', 'Ярче', 'Тяжелее'], correct: 1, explanation: 'Микрофибра захватывает 99% бактерий. Обычная тряпка размазывает грязь.', titleEn: 'Microfiber', questionEn: 'Why is microfiber better than a regular cloth?', optionsEn: ['Cheaper', 'Captures bacteria without chemicals', 'Brighter', 'Heavier'], explanationEn: 'Microfiber captures 99% of bacteria. Regular cloth spreads dirt around.', d: 1 },
        { title: 'Хлорка + аммиак', question: 'Что нельзя смешивать с хлоркой?', image: '☠️', options: ['Воду', 'Аммиак (нашатырь)', 'Соду', 'Мыло'], correct: 1, explanation: 'Хлорка + аммиак = хлорамин, токсичный газ! Может убить.', titleEn: 'Bleach + ammonia', questionEn: 'What must never be mixed with bleach?', optionsEn: ['Water', 'Ammonia', 'Baking soda', 'Soap'], explanationEn: 'Bleach + ammonia = chloramine, toxic gas! Can be fatal.', d: 1 },
        { title: 'Время дезинфекции', question: 'Сколько дезинфектант должен оставаться на поверхности?', image: '⏱️', options: ['1 секунда', '5-10 минут (по инструкции)', 'Мгновенно', '1 час'], correct: 1, explanation: 'Contact time — время контакта. Обычно 5-10 минут для убийства бактерий.', titleEn: 'Disinfection time', questionEn: 'How long must disinfectant stay on the surface?', optionsEn: ['1 second', '5-10 minutes (per instructions)', 'Instantly', '1 hour'], explanationEn: 'Contact time is critical. Usually 5-10 minutes to kill bacteria.', d: 2 },
        { title: 'Цветовая кодировка', question: 'Красная тряпка в международной системе?', image: '🔴', options: ['Кухня', 'Санузлы', 'Офис', 'Стёкла'], correct: 1, explanation: 'Красный = санузлы. Синий = общие. Зелёный = кухня. Жёлтый = изоляция.', titleEn: 'Color coding', questionEn: 'What does a red cloth mean in the international system?', optionsEn: ['Kitchen', 'Restrooms', 'Office', 'Glass'], explanationEn: 'Red = restrooms. Blue = general. Green = kitchen. Yellow = isolation.', d: 2 },
        { title: 'Каменная столешница', question: 'Чем НЕЛЬЗЯ мыть мрамор?', image: '🧴', options: ['Мыльной водой', 'Кислотными средствами (уксус)', 'Тёплой водой', 'Специальным средством'], correct: 1, explanation: 'Кислота растворяет мрамор! Только pH-нейтральные средства.', titleEn: 'Stone countertop', questionEn: 'What must NOT be used to clean marble?', optionsEn: ['Soapy water', 'Acidic cleaners (vinegar)', 'Warm water', 'Special cleaner'], explanationEn: 'Acid dissolves marble! Use only pH-neutral products.', d: 2 },
        { title: 'HEPA фильтр', question: 'Что задерживает HEPA-фильтр?', image: '💨', options: ['Только пыль', '99.97% частиц ≥0.3 мкм', '50% бактерий', 'Запахи'], correct: 1, explanation: 'HEPA: 99.97% частиц 0.3 микрон и больше. Обязателен для аллергиков.', titleEn: 'HEPA filter', questionEn: 'What does a HEPA filter capture?', optionsEn: ['Dust only', '99.97% of particles ≥0.3 µm', '50% of bacteria', 'Odors'], explanationEn: 'HEPA: 99.97% of particles 0.3 microns and larger. Essential for allergy sufferers.', d: 2 },
        { title: 'Ковёр', question: 'Метод горячей экстракции ковров?', image: '🧶', options: ['Пылесос', 'Горячая вода + химия → вакуум', 'Стирка в машинке', 'Выбивание'], correct: 1, explanation: 'Горячая экстракция: 60-70°C раствор впрыскивается и тут же всасывается.', titleEn: 'Carpet', questionEn: 'What is hot water extraction for carpets?', optionsEn: ['Vacuum only', 'Hot water + chemicals injected then vacuumed', 'Machine wash', 'Beating'], explanationEn: 'Hot extraction: 60-70°C solution is injected and immediately vacuumed up.', d: 2 },
        { title: 'Биологические', question: 'Как убирать биологические жидкости (кровь)?', image: '🩸', options: ['Обычной тряпкой', 'В СИЗ + дезинфекция + спецпакет', 'Водой', 'Игнорировать'], correct: 1, explanation: 'Перчатки + маска. Дезинфекция хлоросодержащим. Утилизация в биопакет.', d: 3 },
        { title: 'Плесень', question: 'Как правильно удалить плесень?', image: '🦠', options: ['Протереть', 'Антиплесневое + обработать причину влаги', 'Закрасить', 'Пылесосом'], correct: 1, explanation: 'Убить плесень + устранить источник влаги. Иначе вернётся через неделю.', d: 3 },
        { title: 'SDS клининг', question: 'Что такое SDS для моющего средства?', image: '📋', options: ['Реклама', 'Паспорт безопасности (Safety Data Sheet)', 'Цена', 'Рецепт'], correct: 1, explanation: 'SDS: состав, опасности, первая помощь, хранение. Обязателен по закону.', d: 3 },
      ]
    },
    // ═══════ 7. MOVING & DELIVERY ═══════
    {
      id: 'pro_moving',
      name: 'Переезд: правила перевозки',
      nameEn: 'Moving: Transport Rules',
      icon: 'map',
      color: 'from-rose-500 to-red-700',
      bgColor: 'bg-slate-100 dark:bg-black/70',
      description: 'Грузоподъёмность, упаковка, безопасность',
      dept: 'moving',
      levels: [
        { title: 'Подъём груза', question: 'Правильная техника подъёма тяжёлого?', image: '📦', options: ['Спиной, наклонясь', 'Ногами, спина прямая', 'Одной рукой', 'Рывком'], correct: 1, explanation: 'Ногами! Спина прямая, колени согнуты. Спина ≠ подъёмный кран.', titleEn: 'Lifting loads', questionEn: 'Correct technique for lifting heavy objects?', optionsEn: ['Back bent', 'Legs, back straight', 'One hand', 'Jerk'], explanationEn: 'Use legs! Back straight, knees bent. Your back is not a crane.', d: 1 },
        { title: 'Максимальный вес', question: 'Макс. вес для одного человека (ISO 11228)?', image: '⚖️', options: ['50 кг', '25 кг', '100 кг', '10 кг'], correct: 1, explanation: 'ISO 11228: максимум 25 кг для мужчин в идеальных условиях.', titleEn: 'Maximum weight', questionEn: 'Max weight for one person (ISO 11228)?', optionsEn: ['50 kg', '25 kg', '100 kg', '10 kg'], explanationEn: 'ISO 11228: maximum 25 kg for men under ideal conditions.', d: 1 },
        { title: 'Холодильник', question: 'Как перевозить холодильник?', image: '🧊', options: ['Лёжа', 'Строго вертикально или под углом ≤45°', 'Вверх ногами', 'На боку'], correct: 1, explanation: 'Вертикально! Если лёжа — масло вытечет из компрессора. После перевозки ждать 4ч.', titleEn: 'Refrigerator', questionEn: 'How to transport a refrigerator?', optionsEn: ['Lying down', 'Strictly upright or at angle ≤45°', 'Upside down', 'On its side'], explanationEn: 'Upright! If horizontal — oil leaks from compressor. Wait 4 hours after moving before plugging in.', d: 1 },
        { title: 'Стекло', question: 'Как транспортировать стекло/зеркало?', image: '🪟', options: ['Горизонтально', 'Вертикально, в пузырчатой плёнке', 'В газете', 'Без упаковки'], correct: 1, explanation: 'Всегда вертикально + пузырчатая плёнка + картонные углы. Горизонтально = трещина.', titleEn: 'Glass', questionEn: 'How to transport glass/mirror?', optionsEn: ['Horizontally', 'Vertically, in bubble wrap', 'In newspaper', 'Unpackaged'], explanationEn: 'Always vertical + bubble wrap + cardboard corners. Horizontal = crack.', d: 1 },
        { title: 'Стрейч-плёнка', question: 'Зачем оборачивать мебель стрейч-плёнкой?', image: '📋', options: ['Для красоты', 'Защита от царапин + фиксация дверей/ящиков', 'Для веса', 'Не нужно'], correct: 1, explanation: 'Стрейч: защита + фиксация выдвижных частей. Дёшево и эффективно.', titleEn: 'Stretch film', questionEn: 'Why wrap furniture in stretch film?', optionsEn: ['For looks', 'Scratch protection + secures doors/drawers', 'For weight', 'Not needed'], explanationEn: 'Stretch film: protection + secures moving parts. Cheap and effective.', d: 2 },
        { title: 'Развесовка', question: 'Как правильно загружать фургон?', image: '🚛', options: ['Как попало', 'Тяжёлое внизу у кабины, лёгкое сверху', 'Тяжёлое сверху', 'Лёгкое первым'], correct: 1, explanation: 'Тяжёлое: низ + ближе к кабине = устойчивость. Лёгкое и хрупкое — сверху.', titleEn: 'Load distribution', questionEn: 'How to correctly load a van?', optionsEn: ['Randomly', 'Heavy at bottom near cab, light on top', 'Heavy on top', 'Light first'], explanationEn: 'Heavy: low + near cab = stability. Light and fragile — on top.', d: 2 },
        { title: 'Ремни крепления', question: 'Чем фиксировать груз в кузове?', image: '🔗', options: ['Ничем', 'Стяжные ремни (рэтчеты)', 'Верёвкой', 'Надеяться на лучшее'], correct: 1, explanation: 'Рэтчеты (стяжные ремни) с сертификатом. Верёвка ненадёжна!', titleEn: 'Cargo straps', questionEn: 'How to secure cargo in the van?', optionsEn: ['Nothing', 'Ratchet straps', 'Rope', 'Hope for the best'], explanationEn: 'Certified ratchet straps. Rope is unreliable!', d: 2 },
        { title: 'Стиральная машина', question: 'Что обязательно перед перевозкой стиралки?', image: '🧺', options: ['Ничего', 'Закрутить транспортировочные болты', 'Заполнить водой', 'Снять дверцу'], correct: 1, explanation: 'Транспортировочные болты фиксируют барабан. Без них = поломка при тряске.', titleEn: 'Washing machine', questionEn: 'What is required before transporting a washing machine?', optionsEn: ['Nothing', 'Install transport bolts', 'Fill with water', 'Remove door'], explanationEn: 'Transport bolts secure the drum. Without them = damage from vibration.', d: 2 },
        { title: 'Пианино', question: 'Минимум людей для перевозки пианино?', image: '🎹', options: ['1', '2', '4 человека + оборудование', '10'], correct: 2, explanation: 'Пианино: 200-400 кг. Минимум 4 человека + рохля/ремни. Нет места для ошибки.', titleEn: 'Piano', questionEn: 'Minimum people to move a piano?', optionsEn: ['1', '2', '4 people + equipment', '10'], explanationEn: 'Piano: 200-400 kg. Minimum 4 people + dolly/straps. No room for error.', d: 3 },
        { title: 'Лифт грузоподъёмность', question: 'Средняя грузоподъёмность пассажирского лифта?', image: '🛗', options: ['100 кг', '400-630 кг', '2000 кг', '50 кг'], correct: 1, explanation: '400-630 кг типичный. НИКОГДА не перегружать! Проверяйте табличку.', titleEn: 'Elevator capacity', questionEn: 'Typical passenger elevator capacity?', optionsEn: ['100 kg', '400-630 kg', '2000 kg', '50 kg'], explanationEn: '400-630 kg typical. NEVER overload! Check the placard.', d: 2 },
        { title: 'Документы', question: 'Какие документы при коммерческой перевозке?', image: '📝', options: ['Никаких', 'ТТН + опись + страховка', 'Только паспорт', 'Визитка'], correct: 1, explanation: 'Товарно-транспортная накладная + опись имущества + страхование.', titleEn: 'Documents', questionEn: 'What documents for commercial moving?', optionsEn: ['None', 'Bill of lading + inventory + insurance', 'Passport only', 'Business card'], explanationEn: 'Bill of lading + property inventory + insurance.', d: 3 },
      ]
    },
    // ═══════ 8. SECURITY (PROFESSIONAL) ═══════
    {
      id: 'pro_security',
      name: 'Охрана: законы и тактика',
      nameEn: 'Security: Law & Tactics',
      icon: 'shield',
      color: 'from-indigo-500 to-purple-600',
      bgColor: 'bg-indigo-100',
      description: 'Правовые основы, тактика, оборудование',
      dept: 'security',
      levels: [
        { title: 'Необходимая оборона', question: 'Когда охранник может применить силу?', image: '🛡️', options: ['Всегда', 'При реальной угрозе жизни/здоровью', 'По настроению', 'Никогда'], correct: 1, explanation: 'Только при реальной и непосредственной угрозе. Соразмерно!', titleEn: 'Self-defense', questionEn: 'When may a security guard use force?', optionsEn: ['Always', 'When there is a real threat to life/health', 'When they feel like it', 'Never'], explanationEn: 'Only when there is a real and imminent threat. Proportional response!', d: 1 },
        { title: 'Документирование', question: 'Что записывать в журнал охраны?', image: '📝', options: ['Только ЧП', 'ВСЁ: время, события, посетители, проверки', 'Ничего', 'Погоду'], correct: 1, explanation: 'Всё! Время, обход, посетители, инциденты. Журнал = доказательство.', titleEn: 'Documentation', questionEn: 'What to record in the security log?', optionsEn: ['Emergencies only', 'EVERYTHING: time, events, visitors, checks', 'Nothing', 'Weather'], explanationEn: 'Everything! Time, patrols, visitors, incidents. Log = evidence.', d: 1 },
        { title: 'Обход', question: 'Почему менять маршрут обхода?', image: '🚶', options: ['Скука', 'Чтобы злоумышленник не предсказал', 'Физнагрузка', 'Правила'], correct: 1, explanation: 'Предсказуемый маршрут = уязвимость. Меняйте время и путь!', titleEn: 'Patrol', questionEn: 'Why vary the patrol route?', optionsEn: ['Boredom', 'So intruders cannot predict it', 'Exercise', 'Rules'], explanationEn: 'Predictable route = vulnerability. Vary time and path!', d: 1 },
        { title: 'Радиообмен', question: 'Правильный радиопозывной?', image: '📻', options: ['Алло', 'Позывной + сообщение + приём', 'Кричать', 'Шёпот'], correct: 1, explanation: '"Пост-1, Базе. Обход завершён. Норма. Приём." — стандарт.', titleEn: 'Radio protocol', questionEn: 'Correct radio call format?', optionsEn: ['Hello', 'Call sign + message + over', 'Yelling', 'Whispering'], explanationEn: '"Post-1 to Base. Patrol complete. All clear. Over." — standard format.', d: 2 },
        { title: 'CCTV', question: 'Сколько хранить видео с камер?', image: '📹', options: ['1 день', '30 дней минимум (GDPR)', '1 час', 'Навсегда'], correct: 1, explanation: '30 дней — стандарт. GDPR/закон требует обоснования дольше.', titleEn: 'CCTV', questionEn: 'How long to store surveillance footage?', optionsEn: ['1 day', '30 days minimum (GDPR)', '1 hour', 'Forever'], explanationEn: '30 days — standard. GDPR/law requires justification for longer retention.', d: 2 },
        { title: 'Досмотр', question: 'Может ли частный охранник проводить досмотр?', image: '🔍', options: ['Всегда', 'Только с согласия или по правилам объекта', 'Никогда', 'Полицейский может'], correct: 1, explanation: 'Частный охранник — только с согласия лица. Принудительный досмотр = полиция.', titleEn: 'Search', questionEn: 'Can a private security guard conduct a search?', optionsEn: ['Always', 'Only with consent or per site rules', 'Never', 'Only police can'], explanationEn: 'Private guard — only with person\'s consent. Forced search = police matter.', d: 2 },
        { title: 'Пожар на объекте', question: 'Порядок действий охранника при пожаре?', image: '🔥', options: ['Тушить', 'Тревога → эвакуация → вызов → доклад', 'Убежать', 'Ждать'], correct: 1, explanation: '1. Сигнал тревоги. 2. Эвакуация. 3. Вызов 101/112. 4. Доклад.', titleEn: 'Fire on premises', questionEn: 'Security guard procedure during fire?', optionsEn: ['Fight fire', 'Alarm → evacuate → call 101/112 → report', 'Run away', 'Wait'], explanationEn: '1. Sound alarm. 2. Evacuate. 3. Call 101/112. 4. Report.', d: 2 },
        { title: 'Задержание', question: 'Максимальное время задержания охранником?', image: '⏱️', options: ['Сколько хочет', 'До приезда полиции (разумное время)', '24 часа', '1 минута'], correct: 1, explanation: 'Только до прибытия полиции. Обычно 30-60 минут максимум.', titleEn: 'Detention', questionEn: 'Maximum detention time by security guard?', optionsEn: ['As long as they want', 'Until police arrive (reasonable time)', '24 hours', '1 minute'], explanationEn: 'Only until police arrive. Usually 30-60 minutes maximum.', d: 3 },
        { title: 'Оружие', question: 'Когда охранник может применить оружие?', image: '🔫', options: ['Всегда', 'Крайняя необходимость, угроза жизни', 'По желанию', 'Никогда'], correct: 1, explanation: 'Только при непосредственной угрозе жизни. Предупреждение → предупредительный выстрел → применение.', titleEn: 'Weapons', questionEn: 'When may a security guard use a weapon?', optionsEn: ['Always', 'Extreme necessity, threat to life', 'At will', 'Never'], explanationEn: 'Only when there is direct threat to life. Warning → warning shot → use.', d: 3 },
        { title: 'Социальная инженерия', question: 'Что такое социальная инженерия?', image: '🎭', options: ['Строительство', 'Обман для получения доступа', 'Программирование', 'Маркетинг'], correct: 1, explanation: '"Я из ИТ, нужен ваш пропуск" — типичная атака. Всегда проверяйте!', titleEn: 'Social engineering', questionEn: 'What is social engineering?', optionsEn: ['Construction', 'Deception to gain access', 'Programming', 'Marketing'], explanationEn: '"I\'m from IT, I need your badge" — typical attack. Always verify!', d: 3 },
        { title: 'Периметр', question: 'Принцип "защита в глубину"?', image: '🏰', options: ['Один забор', 'Несколько уровней: периметр → здание → зона → объект', 'Камеры', 'Охранник'], correct: 1, explanation: 'Defense in depth: каждый уровень замедляет и обнаруживает. Не полагайтесь на одно!', titleEn: 'Perimeter', questionEn: 'What is "defense in depth" principle?', optionsEn: ['One fence', 'Multiple layers: perimeter → building → zone → asset', 'Cameras', 'Guard'], explanationEn: 'Defense in depth: each layer slows and detects. Don\'t rely on one!', d: 3 },
      ]
    },
    // ═══════ 9. AUTO & GARAGE ═══════
    {
      id: 'pro_auto',
      name: 'Авто: техника и безопасность',
      nameEn: 'Auto: Mechanics & Safety',
      icon: 'settings',
      color: 'from-zinc-600 to-stone-800',
      bgColor: 'bg-zinc-100',
      description: 'Диагностика, буксировка, шиномонтаж',
      dept: 'auto',
      levels: [
        { title: 'Домкрат', question: 'Куда ставить домкрат?', image: '🚗', options: ['Куда угодно', 'Только на усиленные точки кузова', 'На бампер', 'На порог'], correct: 1, explanation: 'Только на заводские точки поддомкрачивания! Иначе помнёте кузов.', titleEn: 'Jack', questionEn: 'Where to place the jack?', optionsEn: ['Anywhere', 'Only on reinforced body jack points', 'On bumper', 'On rocker panel'], explanationEn: 'Only on factory jacking points! Otherwise you will damage the body.', d: 1 },
        { title: 'Масло', question: 'Как часто менять масло?', image: '🛢️', options: ['Раз в год', 'По регламенту: 10-15 тыс. км или раз в год', 'Никогда', 'Каждую неделю'], correct: 1, explanation: 'Регламент производителя. Обычно 10-15 тыс. км или 1 год.', titleEn: 'Oil', questionEn: 'How often to change oil?', optionsEn: ['Once a year', 'Per manual: 10-15k km or annually', 'Never', 'Every week'], explanationEn: 'Follow manufacturer schedule. Usually 10-15k km or 1 year.', d: 1 },
        { title: 'Колесо', question: 'Порядок затяжки болтов колеса?', image: '🛞', options: ['По кругу', 'Крест-накрест (звёздочкой)', 'Случайно', 'Все сразу'], correct: 1, explanation: 'Крест-накрест = равномерный прижим. По кругу = перекос диска!', titleEn: 'Wheel', questionEn: 'Correct order for tightening wheel bolts?', optionsEn: ['In sequence', 'Criss-cross (star pattern)', 'Random', 'All at once'], explanationEn: 'Criss-cross = even clamping. Sequential = disk warping!', d: 1 },
        { title: 'Давление шин', question: 'Когда проверять давление?', image: '📊', options: ['После поездки', 'На холодных шинах', 'После накачки', 'Неважно'], correct: 1, explanation: 'Только на холодных! После езды давление выше на 0.2-0.5 бар.', titleEn: 'Tire pressure', questionEn: 'When to check tire pressure?', optionsEn: ['After driving', 'On cold tires', 'After inflating', 'Doesn\'t matter'], explanationEn: 'Only when cold! After driving pressure is 0.2-0.5 bar higher.', d: 1 },
        { title: 'Антифриз', question: 'Можно ли смешивать антифризы разных цветов?', image: '🧪', options: ['Да', 'Нет, возможна реакция и осадок', 'Только красный с зелёным', 'Все одинаковые'], correct: 1, explanation: 'Разные составы могут реагировать! Осадок забивает радиатор. Только одинаковые.', titleEn: 'Antifreeze', questionEn: 'Can you mix antifreezes of different colors?', optionsEn: ['Yes', 'No, reaction and sediment possible', 'Only red with green', 'All are the same'], explanationEn: 'Different formulations can react! Sediment clogs radiator. Same type only.', d: 2 },
        { title: 'Буксировка АКПП', question: 'Можно ли буксировать авто с АКПП?', image: '🚛', options: ['Да, без ограничений', 'Ограничено: 50 км/ч, до 50 км, N', 'Нет, только эвакуатор', 'На любой скорости'], correct: 1, explanation: 'Режим N, скорость ≤50 км/ч, дистанция ≤50 км. Иначе = ремонт АКПП.', titleEn: 'Towing automatic', questionEn: 'Can you tow a car with automatic transmission?', optionsEn: ['Yes, no limits', 'Limited: 50 km/h, up to 50 km, N', 'No, tow truck only', 'Any speed'], explanationEn: 'Neutral, speed ≤50 km/h, distance ≤50 km. Otherwise = transmission repair.', d: 2 },
        { title: 'OBD2', question: 'Что такое OBD2?', image: '📊', options: ['Масло', 'Бортовая диагностика (порт ошибок)', 'Тип двигателя', 'Навигация'], correct: 1, explanation: 'OBD2: стандартный порт диагностики. Читает ошибки двигателя и систем.', titleEn: 'OBD2', questionEn: 'What is OBD2?', optionsEn: ['Oil', 'On-board diagnostics (fault code port)', 'Engine type', 'Navigation'], explanationEn: 'OBD2: standard diagnostic port. Reads engine and system error codes.', d: 2 },
        { title: 'Тормозная жидкость', question: 'Почему менять тормозную жидкость?', image: '⚠️', options: ['Для цвета', 'Впитывает воду → снижается температура кипения', 'Не нужно', 'Для запаха'], correct: 1, explanation: 'DOT-жидкость гигроскопична. Вода = пузыри при нагреве = отказ тормозов!', titleEn: 'Brake fluid', questionEn: 'Why change brake fluid?', optionsEn: ['For color', 'Absorbs water → boiling point drops', 'Not needed', 'For smell'], explanationEn: 'DOT fluid is hygroscopic. Water = vapor bubbles when hot = brake failure!', d: 2 },
        { title: 'Аккумулятор', question: 'Порядок подключения проводов прикуривания?', image: '🔋', options: ['Минус первый', 'Плюс→Плюс, Минус→Масса', 'Как хочешь', 'Минус→Плюс'], correct: 1, explanation: 'Красный: + донора → + севшего. Чёрный: - донора → масса (двигатель) севшего.', d: 3 },
        { title: 'Момент затяжки', question: 'Зачем нужен динамометрический ключ?', image: '🔧', options: ['Для скорости', 'Точный момент затяжки = безопасность', 'Для красоты', 'Неважно'], correct: 1, explanation: 'Колёсные болты: 100-130 Нм. Недотянуто = отпадёт. Перетянуто = сорвёт резьбу.', titleEn: 'Torque wrench', questionEn: 'Why use a torque wrench?', optionsEn: ['For speed', 'Precise torque = safety', 'For looks', 'Doesn\'t matter'], explanationEn: 'Wheel bolts: 100-130 Nm. Under-torqued = wheel falls off. Over-torqued = stripped threads.', d: 3 },
        { title: 'Гибрид/электро', question: 'Главная опасность при работе с электрокаром?', image: '⚡', options: ['Шум', 'Высоковольтная батарея 400-800В', 'Запах', 'Вибрация'], correct: 1, explanation: '400-800В = смертельно! Оранжевые провода = высокое напряжение. Не трогать!', titleEn: 'Hybrid/Electric', questionEn: 'Main hazard when working on an electric car?', optionsEn: ['Noise', '400-800V high-voltage battery', 'Smell', 'Vibration'], explanationEn: '400-800V = lethal! Orange cables = high voltage. Do not touch!', d: 3 },
      ]
    },
  ];

  const generalModules = [
    {
      id: 'fire',
      name: 'Пожарная безопасность',
      nameEn: 'Fire Safety',
      icon: 'fire',
      color: 'from-orange-500 to-red-600',
      bgColor: 'bg-slate-100 dark:bg-black/70',
      description: 'Международные стандарты тушения и эвакуации',
      levels: [
        { title: 'Эвакуация', question: 'При пожаре в высотном здании, что нужно делать?', image: '🏢', options: ['Использовать лифт', 'Спускаться по лестнице', 'Открыть все окна', 'Ждать на месте'], correct: 1, explanation: 'Всегда используйте лестницу! Лифты могут остановиться или открыться на горящем этаже.', titleEn: 'Evacuation', questionEn: 'In a high-rise fire, what should you do?', optionsEn: ['Use elevator', 'Use stairs', 'Open all windows', 'Wait in place'], explanationEn: 'Always use stairs! Elevators may stop or open on a burning floor.', d: 1 },
        { title: 'Дым', question: 'Как двигаться в задымлённом помещении?', image: '💨', options: ['Бегом во весь рост', 'Низко пригнувшись', 'На четвереньках спиной', 'Прыжками'], correct: 1, explanation: 'Дым и горячий воздух поднимаются вверх. Внизу больше кислорода.', titleEn: 'Smoke', questionEn: 'How to move in a smoke-filled room?', optionsEn: ['Run upright', 'Stay low', 'Crawl backward on all fours', 'Jump'], explanationEn: 'Smoke and hot air rise. More oxygen near the floor.', d: 1 },
        { title: 'Горящая одежда', question: 'Что делать, если на человеке загорелась одежда?', image: '🔥', options: ['Бежать', 'Остановись-Упади-Катайся', 'Снять одежду', 'Облить бензином'], correct: 1, explanation: 'Stop-Drop-Roll — международный стандарт при горящей одежде.', titleEn: 'Burning Clothing', questionEn: 'What to do if clothing catches fire?', optionsEn: ['Run', 'Stop-Drop-Roll', 'Remove clothing', 'Douse with gasoline'], explanationEn: 'Stop-Drop-Roll — international standard for burning clothing.', d: 1 },
        { title: 'Пожарная сигнализация', question: 'Что делать при срабатывании пожарной сигнализации?', image: '🔔', options: ['Игнорировать', 'Начать эвакуацию', 'Искать огонь', 'Позвонить в офис'], correct: 1, explanation: 'Всегда эвакуируйтесь при сигнале! Ваша жизнь важнее.', titleEn: 'Fire Alarm', questionEn: 'What to do when fire alarm activates?', optionsEn: ['Ignore it', 'Begin evacuation', 'Search for fire', 'Call office'], explanationEn: 'Always evacuate when alarm sounds! Your life matters most.', d: 1 },
        { title: 'Типы огнетушителей', question: 'Какой огнетушитель для электрооборудования?', image: '🧯', options: ['Водный (A)', 'Пенный (AB)', 'CO₂ (BCE)', 'Порошковый (A)'], correct: 2, explanation: 'CO₂ огнетушители безопасны для электрооборудования.', titleEn: 'Fire Extinguisher Types', questionEn: 'Which extinguisher for electrical equipment?', optionsEn: ['Water (A)', 'Foam (AB)', 'CO₂ (BCE)', 'Dry powder (A)'], explanationEn: 'CO₂ extinguishers are safe for electrical equipment.', d: 2 },
        { title: 'P.A.S.S. Техника', question: 'Что означает буква "P" в технике P.A.S.S.?', image: '🔥', options: ['Push', 'Pull (Выдернуть)', 'Point', 'Protect'], correct: 1, explanation: 'P.A.S.S. = Pull, Aim, Squeeze, Sweep.', titleEn: 'P.A.S.S. Technique', questionEn: 'What does "P" stand for in P.A.S.S.?', optionsEn: ['Push', 'Pull', 'Point', 'Protect'], explanationEn: 'P.A.S.S. = Pull, Aim, Squeeze, Sweep.', d: 2 },
        { title: 'Классы пожаров', question: 'К какому классу относится пожар горящего масла?', image: '🍳', options: ['Класс A', 'Класс B', 'Класс C', 'Класс F'], correct: 3, explanation: 'Класс F (K в США) — пищевые масла и жиры.', titleEn: 'Fire Classes', questionEn: 'What class is a cooking oil fire?', optionsEn: ['Class A', 'Class B', 'Class C', 'Class F'], explanationEn: 'Class F (K in US) — cooking oils and fats.', d: 2 },
        { title: 'Дистанция тушения', question: 'С какого расстояния начинать тушить?', image: '📏', options: ['0.5 м', '1-2 м', '2-3 м', '5+ м'], correct: 2, explanation: '2-3 метра — оптимальное расстояние.', titleEn: 'Extinguishing Distance', questionEn: 'From what distance to start extinguishing?', optionsEn: ['0.5 m', '1-2 m', '2-3 m', '5+ m'], explanationEn: '2-3 meters is optimal distance.', d: 2 },
        { title: 'Проверка двери', question: 'Как проверить дверь при пожаре?', image: '🚪', options: ['Резко открыть', 'Тыльной стороной руки', 'Пнуть ногой', 'Открыть медленно'], correct: 1, explanation: 'Тыльная сторона руки чувствительнее.', titleEn: 'Door Check', questionEn: 'How to check a door during a fire?', optionsEn: ['Open forcefully', 'Back of hand', 'Kick with foot', 'Open slowly'], explanationEn: 'Back of hand is more heat-sensitive.', d: 2 },
        { title: 'Точка сбора', question: 'Где должна быть точка сбора?', image: '🏃', options: ['У входа', 'На парковке', 'Минимум 15м от здания', 'Внутри соседнего здания'], correct: 2, explanation: 'Минимум 15 метров от здания.', titleEn: 'Assembly Point', questionEn: 'Where should the assembly point be?', optionsEn: ['At the entrance', 'In the parking lot', 'Minimum 15m from building', 'Inside adjacent building'], explanationEn: 'Minimum 15 meters from the building.', d: 2 },
        { title: 'Backdraft', question: 'Что такое Backdraft?', image: '💥', options: ['Слабый огонь', 'Взрыв при кислороде', 'Медленное тление', 'Тушение водой'], correct: 1, explanation: 'Backdraft — взрыв при поступлении воздуха. Крайне опасен!', titleEn: 'Backdraft', questionEn: 'What is a backdraft?', optionsEn: ['Weak fire', 'Explosion when oxygen enters', 'Slow smoldering', 'Water extinguishing'], explanationEn: 'Backdraft — explosion when air enters oxygen-starved fire. Extremely dangerous!', d: 3 },
        { title: 'Flashover', question: 'При какой температуре Flashover?', image: '🌡️', options: ['100°C', '300°C', '500-600°C', '1000°C'], correct: 2, explanation: 'Flashover — ~500-600°C.', titleEn: 'Flashover', questionEn: 'At what temperature does flashover occur?', optionsEn: ['100°C', '300°C', '500-600°C', '1000°C'], explanationEn: 'Flashover occurs at ~500-600°C.', d: 3 },
        { title: 'Класс D', question: 'Чем тушить горящий магний?', image: '🔩', options: ['Водой', 'CO₂', 'Специальным порошком', 'Пеной'], correct: 2, explanation: 'Металлы тушат ТОЛЬКО специальными порошками. Вода = взрыв!', titleEn: 'Class D', questionEn: 'How to extinguish burning magnesium?', optionsEn: ['Water', 'CO₂', 'Class D powder', 'Foam'], explanationEn: 'Metal fires require Class D powder ONLY. Water = explosion!', d: 3 },
        { title: 'Класс A', question: 'Что горит при пожаре класса A?', image: '📦', options: ['Жидкости', 'Газы', 'Твёрдые материалы', 'Металлы'], correct: 2, explanation: 'Класс A — твёрдые материалы: дерево, бумага, ткань.', titleEn: 'Class A', questionEn: 'What burns in a Class A fire?', optionsEn: ['Liquids', 'Gases', 'Solid materials', 'Metals'], explanationEn: 'Class A — solid combustibles: wood, paper, fabric.', d: 2 },
        { title: 'Огнетушитель проверка', question: 'Как часто проверять огнетушитель?', image: '🔍', options: ['Каждый день', 'Раз в месяц', 'Раз в год', 'Никогда'], correct: 2, explanation: 'Ежемесячный осмотр + ежегодное ТО.', titleEn: 'Extinguisher Inspection', questionEn: 'How often to inspect fire extinguisher?', optionsEn: ['Daily', 'Monthly', 'Yearly', 'Never'], explanationEn: 'Monthly visual inspection + annual maintenance.', d: 2 }
      ]
    },
    {
      id: 'firstaid',
      name: 'Первая помощь',
      nameEn: 'First Aid',
      icon: 'heart',
      color: 'from-red-500 to-pink-600',
      bgColor: 'bg-red-100',
      description: 'CPR, кровотечения, переломы по стандартам AHA/ERC',
      levels: [
        { title: 'Кровотечение', question: 'Первое действие при кровотечении?', image: '🩸', options: ['Жгут', 'Прямое давление', 'Поднять конечность', 'Промыть'], correct: 1, explanation: 'Прямое давление — первый метод.', titleEn: 'Bleeding', questionEn: 'First action for bleeding?', optionsEn: ['Tourniquet', 'Direct pressure', 'Elevate limb', 'Rinse'], explanationEn: 'Direct pressure — first-line method.', d: 1 },
        { title: 'Ожоги', question: 'Как охлаждать ожог?', image: '🔥', options: ['Льдом', 'Прохладной водой 10-20 мин', 'Маслом', 'Зубной пастой'], correct: 1, explanation: 'Прохладная вода 10-20 минут.', titleEn: 'Burns', questionEn: 'How to cool a burn?', optionsEn: ['Ice', 'Cool water 10-20 min', 'Oil', 'Toothpaste'], explanationEn: 'Cool running water 10-20 minutes.', d: 1 },
        { title: 'Recovery', question: 'Когда применять боковое положение?', image: '🛌', options: ['При переломе', 'Без сознания, но дышит', 'При сердечном', 'При кровотечении'], correct: 1, explanation: 'Recovery position — для без сознания, но дышащих.', titleEn: 'Recovery Position', questionEn: 'When to use recovery position?', optionsEn: ['For fracture', 'Unconscious but breathing', 'Cardiac arrest', 'Bleeding'], explanationEn: 'Recovery position — for unconscious but breathing victims.', d: 1 },
        { title: 'Перелом', question: 'Главное правило при переломе?', image: '🦴', options: ['Вправить', 'Иммобилизация', 'Массаж', 'Нагрузить'], correct: 1, explanation: 'Иммобилизация — обездвиживание.', titleEn: 'Fracture', questionEn: 'Main rule for a fracture?', optionsEn: ['Reduce it', 'Immobilization', 'Massage', 'Load it'], explanationEn: 'Immobilization — prevent movement of the injured part.', d: 1 },
        { title: 'CPR Компрессии', question: 'Глубина компрессий при СЛР взрослого?', image: '❤️', options: ['2-3 см', '5-6 см', '8-10 см', '1-2 см'], correct: 1, explanation: 'AHA/ERC 2020: 5-6 см, 100-120 в минуту.', titleEn: 'CPR Compressions', questionEn: 'Depth of compressions for adult CPR?', optionsEn: ['2-3 cm', '5-6 cm', '8-10 cm', '1-2 cm'], explanationEn: 'AHA/ERC 2020: 5-6 cm, 100-120 per minute.', d: 2 },
        { title: 'Соотношение CPR', question: 'Соотношение компрессий к вдохам?', image: '🫁', options: ['15:2', '30:2', '15:1', '10:2'], correct: 1, explanation: '30:2 — международный стандарт.', titleEn: 'CPR Ratio', questionEn: 'Compression-to-breath ratio?', optionsEn: ['15:2', '30:2', '15:1', '10:2'], explanationEn: '30:2 — international standard (AHA/ERC).', d: 2 },
        { title: 'Геймлих', question: 'Куда направлены толчки Геймлиха?', image: '😮', options: ['В спину', 'В грудь', 'Внутрь и вверх', 'Вниз'], correct: 2, explanation: 'Внутрь и вверх, под диафрагму.', titleEn: 'Heimlich', questionEn: 'In what direction are Heimlich thrusts?', optionsEn: ['To the back', 'To the chest', 'Inward and upward', 'Downward'], explanationEn: 'Inward and upward, below the diaphragm.', d: 2 },
        { title: 'FAST тест', question: 'Что проверяет "F" в тесте FAST?', image: '🧠', options: ['Fingers', 'Face', 'Feet', 'Focus'], correct: 1, explanation: 'FAST: Face, Arms, Speech, Time.', titleEn: 'FAST Test', questionEn: 'What does "F" check in FAST stroke test?', optionsEn: ['Fingers', 'Face', 'Feet', 'Focus'], explanationEn: 'FAST: Face, Arms, Speech, Time.', d: 2 },
        { title: 'ABC', question: 'Что означает ABC?', image: '🔤', options: ['Always Be Careful', 'Airway-Breathing-Circulation', 'Alert-Blood-Check', 'Assess-Bandage-Call'], correct: 1, explanation: 'Airway, Breathing, Circulation.', titleEn: 'ABC', questionEn: 'What does ABC stand for?', optionsEn: ['Always Be Careful', 'Airway-Breathing-Circulation', 'Alert-Blood-Check', 'Assess-Bandage-Call'], explanationEn: 'Airway, Breathing, Circulation.', d: 2 },
        { title: 'Шок', question: 'Позиция при шоке?', image: '😰', options: ['Сидя', 'Ноги выше головы', 'На животе', 'Стоя'], correct: 1, explanation: 'Ноги приподняты.', titleEn: 'Shock', questionEn: 'Position for shock?', optionsEn: ['Sitting', 'Legs elevated above heart', 'On stomach', 'Standing'], explanationEn: 'Legs elevated (unless contraindicated).', d: 2 },
        { title: 'AED', question: 'Можно ли AED на мокром человеке?', image: '⚡', options: ['Да', 'Нет', 'Сначала вытереть', 'Только в воде'], correct: 2, explanation: 'Вытереть грудь насухо!', titleEn: 'AED', questionEn: 'Can you use AED on a wet person?', optionsEn: ['Yes', 'No', 'Dry chest first', 'Only in water'], explanationEn: 'Dry the chest first!', d: 3 },
        { title: 'Анафилаксия', question: 'Куда вводят адреналин?', image: '💉', options: ['В вену', 'В бедро', 'В ягодицу', 'Под язык'], correct: 1, explanation: 'EpiPen — в бедро.', titleEn: 'Anaphylaxis', questionEn: 'Where to inject epinephrine?', optionsEn: ['Intravenously', 'Into thigh', 'Into buttock', 'Under tongue'], explanationEn: 'EpiPen — into the thigh.', d: 3 },
        { title: 'CPR детям', question: 'Глубина компрессий для ребёнка?', image: '👶', options: ['2 см', '4-5 см', '6-7 см', '1 см'], correct: 1, explanation: '4-5 см, 1/3 грудной клетки.', titleEn: 'CPR for Children', questionEn: 'Compression depth for child?', optionsEn: ['2 cm', '4-5 cm', '6-7 cm', '1 cm'], explanationEn: '4-5 cm, 1/3 of chest depth (AHA/ERC).', d: 3 },
        { title: 'Укус змеи', question: 'Что НЕЛЬЗЯ при укусе змеи?', image: '🐍', options: ['Обездвижить', 'Высасывать яд', 'Вызвать скорую', 'Снять украшения'], correct: 1, explanation: 'Никогда не высасывайте яд!', titleEn: 'Snake Bite', questionEn: 'What must you NOT do for snake bite?', optionsEn: ['Immobilize', 'Suck out venom', 'Call emergency', 'Remove jewelry'], explanationEn: 'Never suck out venom!', d: 3 },
        { title: 'Тепловой удар', question: 'Признак теплового удара?', image: '☀️', options: ['Потливость', 'Горячая СУХАЯ кожа', 'Озноб', 'Голод'], correct: 1, explanation: 'Кожа горячая и сухая!', titleEn: 'Heat Stroke', questionEn: 'Sign of heat stroke?', optionsEn: ['Sweating', 'Hot DRY skin', 'Chills', 'Hunger'], explanationEn: 'Skin is hot and dry!', d: 3 },
        { title: 'Отравление', question: 'При неизвестном отравлении?', image: '☠️', options: ['Вызвать рвоту', 'Молоко', 'НЕ рвоту, звонить 112', 'Уголь'], correct: 2, explanation: 'Не вызывать рвоту!', titleEn: 'Poisoning', questionEn: 'For unknown poisoning?', optionsEn: ['Induce vomiting', 'Give milk', 'Do NOT induce vomiting, call 112/911', 'Charcoal'], explanationEn: 'Do not induce vomiting! Call poison control.', d: 3 },
        { title: 'Нос', question: 'Как остановить носовое кровотечение?', image: '👃', options: ['Голову назад', 'Вперёд, зажать', 'Лечь', 'Вату глубоко'], correct: 1, explanation: 'Голова вперёд + зажать.', titleEn: 'Nosebleed', questionEn: 'How to stop a nosebleed?', optionsEn: ['Tilt head back', 'Lean forward, pinch', 'Lie down', 'Stuff cotton deep'], explanationEn: 'Lean forward + pinch nostrils.', d: 2 },
        { title: 'Гипогликемия', question: 'Что дать при низком сахаре?', image: '🍬', options: ['Инсулин', 'Сахар/сок', 'Солёную воду', 'Ничего'], correct: 1, explanation: 'Быстрые углеводы: сок, сахар.', titleEn: 'Hypoglycemia', questionEn: 'What to give for low blood sugar?', optionsEn: ['Insulin', 'Sugar/juice', 'Salt water', 'Nothing'], explanationEn: 'Fast-acting carbs: juice, sugar.', d: 2 }
      ]
    },
    {
      id: 'rescue',
      name: 'Спасательные операции',
      nameEn: 'Rescue Operations',
      icon: 'lifeBuoy',
      color: 'from-blue-500 to-cyan-600',
      bgColor: 'bg-slate-100 dark:bg-black/70',
      description: 'Водные спасения, эвакуация, транспортировка',
      levels: [
        { title: 'Утопление', question: 'Приоритет при спасении тонущего?', image: '🌊', options: ['Прыгнуть', 'Бросить предмет', 'Звать', 'Ждать'], correct: 1, explanation: 'REACH-THROW-ROW-GO.', titleEn: 'Drowning', questionEn: 'Priority when rescuing a drowning person?', optionsEn: ['Jump in', 'Throw flotation device', 'Yell', 'Wait'], explanationEn: 'REACH-THROW-ROW-GO.', d: 1 },
        { title: 'Recovery', question: 'Позиция для без сознания дышащего?', image: '🛌', options: ['На спине', 'На животе', 'Боковое стабильное', 'Сидя'], correct: 2, explanation: 'Recovery position.', titleEn: 'Recovery', questionEn: 'Position for unconscious breathing victim?', optionsEn: ['On back', 'On stomach', 'Lateral recovery', 'Sitting'], explanationEn: 'Recovery position.', d: 1 },
        { title: 'Позвоночник', question: 'При травме позвоночника?', image: '🦴', options: ['Эвакуировать', 'НЕ двигать', 'Посадить', 'Массаж'], correct: 1, explanation: 'Не двигать!', titleEn: 'Spine Injury', questionEn: 'For suspected spine injury?', optionsEn: ['Evacuate', 'Do NOT move', 'Sit them up', 'Massage'], explanationEn: 'Do not move!', d: 1 },
        { title: 'Firefighter', question: 'Как нести одному?', image: '🚶', options: ['На спине', 'Перед собой', 'Пожарный захват', 'За ноги'], correct: 2, explanation: 'Firefighter\'s carry.', titleEn: 'Firefighter Carry', questionEn: 'How to carry alone?', optionsEn: ['On back', 'In front', 'Firefighter carry', 'By legs'], explanationEn: 'Firefighter\'s carry.', d: 2 },
        { title: 'Гипотермия', question: 'Как согревать при гипотермии?', image: '🥶', options: ['Горячая ванна', 'Растирание', 'Постепенно от центра', 'Алкоголь'], correct: 2, explanation: 'Медленно от центра.', titleEn: 'Hypothermia', questionEn: 'How to rewarm in hypothermia?', optionsEn: ['Hot bath', 'Rubbing', 'Gradually from core', 'Alcohol'], explanationEn: 'Slowly from core outward.', d: 2 },
        { title: 'Log roll', question: 'Log roll при?', image: '🔄', options: ['Утоплении', 'Травме позвоночника', 'Ожогах', 'Переломе ноги'], correct: 1, explanation: 'Log roll при травме позвоночника.', titleEn: 'Log Roll', questionEn: 'When to use log roll?', optionsEn: ['Drowning', 'Spine injury', 'Burns', 'Leg fracture'], explanationEn: 'Log roll for suspected spine injury.', d: 2 },
        { title: 'Жгут', question: 'Жгут максимум на?', image: '🩹', options: ['10 мин', '30 мин', '1-2 часа', 'Без ограничений'], correct: 2, explanation: '1-2 часа максимум!', titleEn: 'Tourniquet', questionEn: 'Tourniquet maximum duration?', optionsEn: ['10 min', '30 min', '1-2 hours', 'No limit'], explanationEn: '1-2 hours maximum!', d: 2 },
        { title: 'Blanket drag', question: 'Когда перенос на одеяле?', image: '🛏️', options: ['Всегда', 'При травме спины', 'При пожаре', 'Никогда'], correct: 2, explanation: 'Быстрая эвакуация.', titleEn: 'Blanket Drag', questionEn: 'When to use blanket drag?', optionsEn: ['Always', 'Spine injury', 'Fire evacuation', 'Never'], explanationEn: 'Rapid evacuation from danger.', d: 2 },
        { title: 'Вторичное утопление', question: '"Вторичное утопление" это?', image: '💧', options: ['Утонуть дважды', 'Отёк через часы', 'Страх воды', 'Судороги'], correct: 1, explanation: 'Отёк лёгких через 1-24 часа.', titleEn: 'Secondary Drowning', questionEn: 'What is "secondary drowning"?', optionsEn: ['Drown twice', 'Pulmonary edema hours later', 'Fear of water', 'Seizures'], explanationEn: 'Pulmonary edema 1-24 hours after water aspiration.', d: 3 },
        { title: 'Confined space', question: 'Первое при спасении из замкнутого?', image: '🕳️', options: ['Войти', 'Проверить воздух', 'Кричать', 'Ждать'], correct: 1, explanation: 'Проверьте атмосферу!', titleEn: 'Confined Space', questionEn: 'First step when rescuing from confined space?', optionsEn: ['Enter', 'Check atmosphere', 'Yell', 'Wait'], explanationEn: 'Check atmosphere first!', d: 3 },
        { title: 'Верёвка', question: 'Минимальная прочность верёвки?', image: '🧵', options: ['500 кг', '1500 кг', '3000 кг', '100 кг'], correct: 2, explanation: '15 kN (~1500 кг).', titleEn: 'Rope', questionEn: 'Minimum rope strength for rescue?', optionsEn: ['500 kg', '1500 kg', '3000 kg', '100 kg'], explanationEn: '15 kN (~1500 kg) minimum.', d: 3 },
        { title: 'Электро', question: 'Как спасать от тока?', image: '⚡', options: ['Схватить', 'Отключить питание', 'Водой', 'Толкнуть'], correct: 1, explanation: 'СНАЧАЛА отключить!', titleEn: 'Electrocution', questionEn: 'How to rescue from electric shock?', optionsEn: ['Grab them', 'Cut power first', 'Water', 'Push them'], explanationEn: 'Cut power FIRST!', d: 3 },
        { title: 'Triage', question: 'Чёрный в START triage?', image: '🏷️', options: ['Лёгкие', 'Срочные', 'Отложенные', 'Погибшие'], correct: 3, explanation: 'Чёрный — погибшие.', titleEn: 'Triage', questionEn: 'What does black mean in START triage?', optionsEn: ['Minor', 'Immediate', 'Delayed', 'Deceased'], explanationEn: 'Black — deceased or expectant.', d: 3 },
        { title: 'Лёд', question: 'Как спасать из-подо льда?', image: '🧊', options: ['Идти', 'Ползти', 'Бежать', 'Прыгать'], correct: 1, explanation: 'Ползком, распределяя вес.', titleEn: 'Ice Rescue', questionEn: 'How to approach someone under ice?', optionsEn: ['Walk', 'Crawl', 'Run', 'Jump'], explanationEn: 'Crawl to distribute weight.', d: 3 },
        { title: 'Лавина', question: 'При накрытии лавиной?', image: '🏔️', options: ['Бежать', 'Плавать, закрыть лицо', 'Кричать', 'Лечь'], correct: 1, explanation: 'Плавательные движения + карман у лица.', titleEn: 'Avalanche', questionEn: 'When caught in avalanche?', optionsEn: ['Run', 'Swim, create air pocket at face', 'Scream', 'Lie still'], explanationEn: 'Swimming motions + create air pocket by face.', d: 3 }
      ]
    },
    {
      id: 'hazmat',
      name: 'Опасные вещества',
      nameEn: 'Hazmat Safety',
      icon: 'alertTriangle',
      color: 'from-slate-400 to-slate-500',
      bgColor: 'bg-slate-100 dark:bg-black/70',
      description: 'Химическая безопасность, маркировка, защита',
      levels: [
        { title: 'Газ', question: 'При утечке газа НЕЛЬЗЯ?', image: '💨', options: ['Открыть окна', 'Включать свет', 'Покинуть', 'Перекрыть'], correct: 1, explanation: 'Искра = взрыв!', titleEn: 'Gas Leak', questionEn: 'What must you NOT do during gas leak?', optionsEn: ['Open windows', 'Turn on/off lights', 'Leave', 'Shut off gas'], explanationEn: 'Any spark = explosion!', d: 1 },
        { title: 'Химожог', question: 'При ожоге кислотой?', image: '🧪', options: ['Нейтрализовать', 'Вода 20+ мин', 'Протереть', 'Маслом'], correct: 1, explanation: 'Только вода!', titleEn: 'Chemical Burn', questionEn: 'For acid burn?', optionsEn: ['Neutralize', 'Flush with water 20+ min', 'Wipe off', 'Apply oil'], explanationEn: 'Flush with water only!', d: 1 },
        { title: 'GHS Пламя', question: 'Пламя в GHS означает?', image: '🔥', options: ['Токсичность', 'Коррозия', 'Воспламеняемость', 'Взрыв'], correct: 2, explanation: 'Воспламеняемость.', titleEn: 'GHS Flame', questionEn: 'Flame symbol in GHS means?', optionsEn: ['Toxicity', 'Corrosion', 'Flammability', 'Explosive'], explanationEn: 'Flammability.', d: 2 },
        { title: 'CO', question: 'Признак отравления CO?', image: '🏭', options: ['Запах', 'Вишнёвая кожа', 'Судороги', 'Кашель'], correct: 1, explanation: 'CO без запаха! Вишнёвая кожа.', titleEn: 'Carbon Monoxide', questionEn: 'Sign of CO poisoning?', optionsEn: ['Smell', 'Cherry-red skin', 'Seizures', 'Cough'], explanationEn: 'CO is odorless! Cherry-red skin is a sign.', d: 2 },
        { title: 'Радиация', question: 'Три принципа защиты?', image: '☢️', options: ['Бег-укрытие-йод', 'Время-расстояние-экран', 'Вода-еда-воздух', 'Бежать'], correct: 1, explanation: 'Time-Distance-Shielding.', titleEn: 'Radiation', questionEn: 'Three principles of radiation protection?', optionsEn: ['Run-shelter-iodine', 'Time-Distance-Shielding', 'Water-food-air', 'Run'], explanationEn: 'Time-Distance-Shielding (ALARA).', d: 2 },
        { title: 'GHS Череп', question: 'Череп в GHS означает?', image: '☠️', options: ['Радиация', 'Острая токсичность', 'Коррозия', 'Окислитель'], correct: 1, explanation: 'Острая токсичность.', titleEn: 'GHS Skull', questionEn: 'Skull symbol in GHS means?', optionsEn: ['Radiation', 'Acute toxicity', 'Corrosion', 'Oxidizer'], explanationEn: 'Acute toxicity.', d: 2 },
        { title: 'Хлор', question: 'Какой запах у хлора?', image: '🧴', options: ['Без запаха', 'Резкий', 'Сладкий', 'Бензин'], correct: 1, explanation: 'Резкий характерный запах.', titleEn: 'Chlorine', questionEn: 'What does chlorine smell like?', optionsEn: ['Odorless', 'Pungent/bleach-like', 'Sweet', 'Gasoline'], explanationEn: 'Pungent bleach-like odor.', d: 2 },
        { title: 'NFPA 704', question: 'Синий в NFPA 704?', image: '🔷', options: ['Пожар', 'Здоровье', 'Реактивность', 'Радиация'], correct: 1, explanation: 'Синий = здоровье.', titleEn: 'NFPA 704', questionEn: 'Blue in NFPA 704 diamond means?', optionsEn: ['Fire hazard', 'Health hazard', 'Reactivity', 'Special/radiation'], explanationEn: 'Blue = health hazard.', d: 3 },
        { title: 'SDS', question: 'Сколько разделов в SDS?', image: '📋', options: ['8', '12', '16', '20'], correct: 2, explanation: '16 разделов по GHS.', titleEn: 'SDS', questionEn: 'How many sections in SDS?', optionsEn: ['8', '12', '16', '20'], explanationEn: '16 sections per GHS.', d: 3 },
        { title: 'Щёлочь', question: 'Что опаснее для кожи?', image: '⚗️', options: ['Кислота', 'Щёлочь', 'Одинаково', 'Ничего'], correct: 1, explanation: 'Щёлочь проникает глубже!', titleEn: 'Alkali', questionEn: 'What is more dangerous to skin?', optionsEn: ['Acid', 'Alkali', 'Equal', 'Neither'], explanationEn: 'Alkalis penetrate deeper into tissue!', d: 3 },
        { title: 'Бензол', question: 'Опасность бензола?', image: '🛢️', options: ['Ожоги', 'Рак крови', 'Слепота', 'Глухота'], correct: 1, explanation: 'Бензол — канцероген.', titleEn: 'Benzene', questionEn: 'Benzene hazard?', optionsEn: ['Burns', 'Blood cancer/leukemia', 'Blindness', 'Deafness'], explanationEn: 'Benzene is a carcinogen (leukemia).', d: 3 },
        { title: 'Ртуть', question: 'Как собирать ртуть?', image: '💧', options: ['Пылесосом', 'Веником', 'Спецнабором', 'Тряпкой'], correct: 2, explanation: 'Только специальными средствами!', titleEn: 'Mercury', questionEn: 'How to collect mercury spill?', optionsEn: ['Vacuum', 'Broom', 'Special spill kit', 'Cloth'], explanationEn: 'Use mercury spill kit only! Never vacuum.', d: 3 },
        { title: 'Асбест', question: 'Опасность асбеста?', image: '🏗️', options: ['Ожоги', 'Рак лёгких', 'Отравление', 'Облучение'], correct: 1, explanation: 'Рак лёгких при вдыхании.', titleEn: 'Asbestos', questionEn: 'Asbestos hazard?', optionsEn: ['Burns', 'Lung cancer', 'Poisoning', 'Radiation'], explanationEn: 'Lung cancer/mesothelioma from inhalation.', d: 3 },
        { title: 'LEL', question: 'Что такое LEL?', image: '📊', options: ['Освещение', 'Нижний предел взрываемости', 'Шум', 'Температура'], correct: 1, explanation: 'Lower Explosive Limit.', titleEn: 'LEL', questionEn: 'What is LEL?', optionsEn: ['Lighting', 'Lower Explosive Limit', 'Noise', 'Temperature'], explanationEn: 'Lower Explosive Limit — minimum concentration to ignite.', d: 3 },
        { title: 'Дезактивация', question: 'Порядок дезактивации?', image: '🚿', options: ['Одежда→душ→медпомощь', 'Душ→одежда→еда', 'Медпомощь', 'Ничего'], correct: 0, explanation: 'Одежда → душ → медпомощь.', titleEn: 'Decontamination', questionEn: 'Decontamination sequence?', optionsEn: ['Clothing removal→shower→medical', 'Shower→clothing→food', 'Medical care', 'Nothing'], explanationEn: 'Remove clothing → shower → medical evaluation.', d: 3 }
      ]
    },
    {
      id: 'security',
      name: 'Охранная деятельность',
      nameEn: 'Security Basics',
      icon: 'shield',
      color: 'from-indigo-500 to-purple-600',
      bgColor: 'bg-indigo-100',
      description: 'Патрулирование, наблюдение, реагирование',
      levels: [
        { title: 'Патрулирование', question: 'Почему маршрут непредсказуемый?', image: '🚶', options: ['Физнагрузка', 'Чтобы не заметили', 'Экономия', 'Правила'], correct: 1, explanation: 'Мешает злоумышленникам.', titleEn: 'Patrolling', questionEn: 'Why use unpredictable patrol routes?', optionsEn: ['Exercise', 'Deters intruders', 'Saves time', 'Rules'], explanationEn: 'Deters intruders from anticipating.', d: 1 },
        { title: 'Описание', question: 'Порядок описания подозреваемого?', image: '🕵️', options: ['Одежда→Лицо', 'Сверху вниз', 'Случайно', 'Снизу вверх'], correct: 1, explanation: 'Сверху вниз.', titleEn: 'Description', questionEn: 'Order for describing a suspect?', optionsEn: ['Clothing→Face', 'Top to bottom', 'Random', 'Bottom to top'], explanationEn: 'Top to bottom.', d: 1 },
        { title: 'Доклад', question: 'Что в докладе об инциденте?', image: '📝', options: ['Имя', 'Who-What-When-Where-How', 'Мнение', 'Фото'], correct: 1, explanation: '5W+H.', titleEn: 'Incident Report', questionEn: 'What to include in incident report?', optionsEn: ['Name only', 'Who-What-When-Where-How', 'Opinion', 'Photos only'], explanationEn: '5W+H format.', d: 1 },
        { title: 'SALUTE', question: '"S" в SALUTE?', image: '👁️', options: ['Speed', 'Size', 'Silence', 'Signal'], correct: 1, explanation: 'Size, Activity, Location, Unit, Time, Equipment.', titleEn: 'SALUTE', questionEn: 'What does "S" stand for in SALUTE?', optionsEn: ['Speed', 'Size', 'Silence', 'Signal'], explanationEn: 'Size, Activity, Location, Unit, Time, Equipment.', d: 2 },
        { title: 'Эскалация', question: 'Порядок эскалации?', image: '📢', options: ['Сила сразу', 'Присутствие→Слова→Действия', 'Игнорировать', 'Оружие'], correct: 1, explanation: 'Presence → Verbal → Physical.', titleEn: 'Use of Force', questionEn: 'Escalation order?', optionsEn: ['Force immediately', 'Presence→Verbal→Physical', 'Ignore', 'Weapon'], explanationEn: 'Presence → Verbal → Physical.', d: 2 },
        { title: 'Пропуск', question: 'Что проверять на пропуске?', image: '🎫', options: ['Фото', 'Документ+лицо+срок', 'Срок', 'Ничего'], correct: 1, explanation: 'Фото=лицо, срок, подлинность.', titleEn: 'Badge Check', questionEn: 'What to verify on an access badge?', optionsEn: ['Photo only', 'Document+face+validity', 'Expiry only', 'Nothing'], explanationEn: 'Photo matches face, validity, authenticity.', d: 2 },
        { title: 'Камера', question: 'Слепая зона камеры?', image: '📹', options: ['Темнота', 'Область вне обзора', 'Дождь', 'Ночь'], correct: 1, explanation: 'Blind spot.', titleEn: 'CCTV', questionEn: 'What is a camera blind spot?', optionsEn: ['Darkness', 'Area outside field of view', 'Rain', 'Night'], explanationEn: 'Blind spot — area not covered.', d: 2 },
        { title: 'De-escalation', question: 'Ключевой приём деэскалации?', image: '🗣️', options: ['Кричать', 'Активное слушание', 'Угрожать', 'Игнорировать'], correct: 1, explanation: 'Активное слушание.', titleEn: 'De-escalation', questionEn: 'Key de-escalation technique?', optionsEn: ['Yelling', 'Active listening', 'Threatening', 'Ignoring'], explanationEn: 'Active listening.', d: 2 },
        { title: 'CPTED', question: 'Что такое CPTED?', image: '🏢', options: ['Оружие', 'Дизайн против преступности', 'Камеры', 'Патруль'], correct: 1, explanation: 'Crime Prevention Through Environmental Design.', titleEn: 'CPTED', questionEn: 'What is CPTED?', optionsEn: ['Weapon', 'Crime Prevention Through Environmental Design', 'Cameras', 'Patrol'], explanationEn: 'Crime Prevention Through Environmental Design.', d: 3 },
        { title: 'Сила', question: 'Сколько уровней применения силы?', image: '💪', options: ['2', '4', '5-6', '10'], correct: 2, explanation: '5-6 уровней.', titleEn: 'Force Continuum', questionEn: 'How many use-of-force levels?', optionsEn: ['2', '4', '5-6', '10'], explanationEn: '5-6 levels typically.', d: 3 },
        { title: 'Задержание', question: 'Когда можно задержать?', image: '🚫', options: ['Всегда', 'Подозрение', 'При преступлении', 'Никогда'], correct: 2, explanation: 'Только при совершении преступления.', titleEn: 'Detention', questionEn: 'When can you detain someone?', optionsEn: ['Always', 'Suspicion', 'Upon commission of crime', 'Never'], explanationEn: 'Only upon commission of a crime (citizen\'s arrest).', d: 3 },
        { title: 'Access control', question: '3 фактора аутентификации?', image: '🔐', options: ['Имя-пароль-email', 'Знание-владение-биометрия', 'Ключ-карта-код', 'Логин-пароль-телефон'], correct: 1, explanation: 'KNOW, HAVE, ARE.', titleEn: 'Access Control', questionEn: 'Three factors of authentication?', optionsEn: ['Name-password-email', 'Knowledge-Possession-Inherence', 'Key-card-code', 'Login-password-phone'], explanationEn: 'KNOW, HAVE, ARE.', d: 3 },
        { title: 'Bomb threat', question: 'При угрозе взрыва?', image: '💣', options: ['Искать', 'Эвакуация', 'Игнорировать', 'Фото'], correct: 1, explanation: 'Эвакуация!', titleEn: 'Bomb Threat', questionEn: 'Upon bomb threat?', optionsEn: ['Search', 'Evacuate', 'Ignore', 'Take photos'], explanationEn: 'Evacuate immediately!', d: 3 },
        { title: 'Chain of custody', question: 'Chain of custody?', image: '⛓️', options: ['Наручники', 'Цепь доказательств', 'Охранная', 'Командная'], correct: 1, explanation: 'Документирование улик.', titleEn: 'Chain of Custody', questionEn: 'What is chain of custody?', optionsEn: ['Handcuffs', 'Documented evidence trail', 'Security chain', 'Command chain'], explanationEn: 'Documented custody of evidence.', d: 3 },
        { title: 'Duress code', question: 'Duress code?', image: '🆘', options: ['Код двери', 'Секретный сигнал опасности', 'Wi-Fi', 'Номер смены'], correct: 1, explanation: 'Тайный сигнал угрозы.', titleEn: 'Duress Code', questionEn: 'What is a duress code?', optionsEn: ['Door code', 'Secret distress signal', 'Wi-Fi password', 'Shift number'], explanationEn: 'Covert signal indicating threat or coercion.', d: 3 }
      ]
    },
    {
      id: 'emergency',
      name: 'Экстренные ситуации',
      nameEn: 'Emergency Response',
      icon: 'zap',
      color: 'from-red-600 to-rose-700',
      bgColor: 'bg-red-100',
      description: 'Реагирование на кризисы и катастрофы',
      levels: [
        { title: 'Землетрясение', question: 'При землетрясении внутри?', image: '🌍', options: ['Бежать', 'Под стол', 'У окна', 'Лифт'], correct: 1, explanation: 'DROP-COVER-HOLD.', titleEn: 'Earthquake', questionEn: 'During earthquake indoors?', optionsEn: ['Run outside', 'Drop-Cover-Hold under table', 'Stand by window', 'Use elevator'], explanationEn: 'DROP-COVER-HOLD — drop, take cover, hold on.', d: 1 },
        { title: 'Торнадо', question: 'Где укрыться от торнадо?', image: '🌪️', options: ['У окна', 'Подвал/внутренняя комната', 'Крыша', 'Машина'], correct: 1, explanation: 'Подвал, нижний этаж.', titleEn: 'Tornado', questionEn: 'Where to shelter from tornado?', optionsEn: ['By window', 'Basement/inner room', 'Roof', 'Car'], explanationEn: 'Basement or lowest floor, interior room.', d: 1 },
        { title: 'Pandemic', question: 'Главная защита от инфекций?', image: '🦠', options: ['Витамины', 'Гигиена рук', 'Антибиотики', 'Бег'], correct: 1, explanation: '20+ секунд мытья рук.', titleEn: 'Pandemic', questionEn: 'Primary protection from infections?', optionsEn: ['Vitamins', 'Hand hygiene', 'Antibiotics', 'Running'], explanationEn: '20+ seconds handwashing.', d: 1 },
        { title: 'Blackout', question: 'При отключении света?', image: '💡', options: ['Паника', 'Проверить автоматы', 'Кричать', 'Бежать'], correct: 1, explanation: 'Проверьте автоматы.', titleEn: 'Blackout', questionEn: 'During power outage?', optionsEn: ['Panic', 'Check circuit breakers', 'Scream', 'Run'], explanationEn: 'Check circuit breakers.', d: 1 },
        { title: 'Цунами', question: 'Признак цунами?', image: '🌊', options: ['Ветер', 'Море отступает', 'Дождь', 'Туман'], correct: 1, explanation: 'Море резко отступило!', titleEn: 'Tsunami', questionEn: 'Sign of impending tsunami?', optionsEn: ['Wind', 'Sea recedes', 'Rain', 'Fog'], explanationEn: 'Rapid sea withdrawal — move to high ground!', d: 2 },
        { title: 'Наводнение', question: 'Опасная глубина воды?', image: '💧', options: ['5 см', '15 см', '10 см', '50 см'], correct: 1, explanation: '15 см может сбить с ног.', titleEn: 'Flooding', questionEn: 'Dangerous depth of flood water?', optionsEn: ['5 cm', '15 cm', '10 cm', '50 cm'], explanationEn: '15 cm can knock you off your feet.', d: 2 },
        { title: 'Active shooter', question: 'При стрелке в здании?', image: '🔫', options: ['Атаковать', 'RUN-HIDE-FIGHT', 'Звонить', 'Кричать'], correct: 1, explanation: 'RUN → HIDE → FIGHT.', titleEn: 'Active Shooter', questionEn: 'During active shooter in building?', optionsEn: ['Attack', 'RUN-HIDE-FIGHT', 'Call only', 'Scream'], explanationEn: 'RUN → HIDE → FIGHT (last resort).', d: 2 },
        { title: 'Gas leak', question: 'При запахе газа?', image: '⛽', options: ['Позвонить', 'НЕ свет, покинуть', 'Открыть газ', 'Курить'], correct: 1, explanation: 'Не включать ничего!', titleEn: 'Gas Leak', questionEn: 'Upon smelling gas?', optionsEn: ['Call only', 'No switches — leave immediately', 'Open gas', 'Smoke'], explanationEn: 'Do not turn on/off anything — evacuate!', d: 2 },
        { title: 'ICS', question: 'Что такое ICS?', image: '📊', options: ['Интернет', 'Incident Command System', 'Камеры', 'Сирена'], correct: 1, explanation: 'Система управления инцидентами.', titleEn: 'ICS', questionEn: 'What is ICS?', optionsEn: ['Internet', 'Incident Command System', 'Cameras', 'Siren'], explanationEn: 'Incident Command System.', d: 3 },
        { title: 'Мародёрство', question: 'Защита после катастрофы?', image: '🏚️', options: ['Уйти', 'Периметр+свет+патруль', 'Ждать', 'Плакат'], correct: 1, explanation: 'Периметр, освещение, охрана.', titleEn: 'Looting', questionEn: 'Protection after disaster?', optionsEn: ['Leave', 'Perimeter+lighting+patrol', 'Wait', 'Signs'], explanationEn: 'Perimeter, lighting, security patrol.', d: 3 }
      ]
    },
    {
      id: 'traffic',
      name: 'Дорожная безопасность',
      nameEn: 'Traffic Safety',
      icon: 'target',
      color: 'from-slate-500 to-slate-600',
      bgColor: 'bg-slate-100 dark:bg-black/70',
      description: 'ПДД, ДТП, регулирование движения',
      levels: [
        { title: 'ДТП', question: 'Первое действие при ДТП?', image: '🚗', options: ['Фото', 'Безопасность', 'Друзьям', 'Уехать'], correct: 1, explanation: 'Безопасность!', titleEn: 'RTA', questionEn: 'First action at road traffic accident?', optionsEn: ['Take photos', 'Safety', 'Call friends', 'Leave'], explanationEn: 'Safety first!', d: 1 },
        { title: 'Пешеход', question: 'Безопасность пешехода ночью?', image: '🚶', options: ['Тёмная одежда', 'Светоотражатели', 'Наушники', 'Бежать'], correct: 1, explanation: 'Светоотражатели!', titleEn: 'Pedestrian', questionEn: 'Pedestrian safety at night?', optionsEn: ['Dark clothing', 'Reflectors', 'Headphones', 'Run'], explanationEn: 'Reflective gear!', d: 1 },
        { title: 'Велосипедист', question: 'Защита велосипедиста?', image: '🚴', options: ['Ничего', 'Шлем', 'Бронежилет', 'Очки'], correct: 1, explanation: 'Шлем снижает риск на 85%.', titleEn: 'Cyclist', questionEn: 'Cyclist head protection?', optionsEn: ['Nothing', 'Helmet', 'Vest', 'Goggles'], explanationEn: 'Helmet reduces head injury risk by ~85%.', d: 1 },
        { title: 'Дистанция', question: 'Правило 3-х секунд?', image: '📏', options: ['Реакция', 'Безопасная дистанция', 'Обгон', 'Остановка'], correct: 1, explanation: '3 секунды до машины впереди.', titleEn: 'Following Distance', questionEn: 'What is the 3-second rule?', optionsEn: ['Reaction time', 'Safe following distance', 'Passing', 'Stopping'], explanationEn: 'Maintain 3 seconds behind vehicle ahead.', d: 2 },
        { title: 'Знак', question: 'Знак на трассе на расстоянии?', image: '⚠️', options: ['10 м', '30 м', '100+ м', '5 м'], correct: 2, explanation: '100 метров минимум.', titleEn: 'Warning Sign', questionEn: 'Warning sign placement on highway?', optionsEn: ['10 m', '30 m', '100+ m', '5 m'], explanationEn: '100 meters minimum.', d: 2 },
        { title: 'Golden hour', question: '"Золотой час"?', image: '⏱️', options: ['Час пик', '60 мин госпитализации', 'Закат', 'Обед'], correct: 1, explanation: 'Критические 60 минут.', titleEn: 'Golden Hour', questionEn: 'What is "golden hour"?', optionsEn: ['Rush hour', '60 min to hospital for trauma', 'Sunset', 'Lunch'], explanationEn: 'Critical 60 minutes for trauma care.', d: 2 },
        { title: 'Горящий авто', question: 'При пожаре машины бежать?', image: '🔥', options: ['К машине', '45°, минимум 30м', 'В машину', 'Никуда'], correct: 1, explanation: 'Под углом 45°, минимум 30м.', titleEn: 'Burning Vehicle', questionEn: 'When car is on fire, run?', optionsEn: ['Toward car', '45° angle, min 30m', 'Into car', 'Nowhere'], explanationEn: '45° angle, minimum 30m away.', d: 2 },
        { title: 'Извлечение', question: 'Когда извлекать из машины?', image: '🚙', options: ['Всегда', 'При угрозе жизни', 'Никогда', 'Просьба'], correct: 1, explanation: 'Только при угрозе!', titleEn: 'Extrication', questionEn: 'When to extract from vehicle?', optionsEn: ['Always', 'Life-threatening situation', 'Never', 'On request'], explanationEn: 'Only when life is threatened!', d: 3 },
        { title: 'Регулировщик', question: 'Руки в стороны означают?', image: '👮', options: ['Все едут', 'Стоп для всех', 'Прямо', 'Поворот'], correct: 1, explanation: 'Стоп для грудь/спина.', titleEn: 'Traffic Controller', questionEn: 'Arms outstretched mean?', optionsEn: ['All go', 'Stop for all', 'Straight', 'Turn'], explanationEn: 'Stop for traffic facing chest/back.', d: 3 },
        { title: 'Мотоцикл', question: 'Почему мотоциклистов не видят?', image: '🏍️', options: ['Быстрые', 'Маленький профиль', 'Без фар', 'Без звука'], correct: 1, explanation: 'Узкий профиль + слепые зоны.', titleEn: 'Motorcycle', questionEn: 'Why are motorcyclists not seen?', optionsEn: ['Too fast', 'Small profile', 'No headlights', 'No sound'], explanationEn: 'Narrow profile + blind spots.', d: 3 }
      ]
    }
  ];

  const modulesData = [...professionalModules, ...generalModules];

  // Shuffled levels storage
  const [shuffledLevels, setShuffledLevels] = createSignal<any[]>([]);
  
  // Full random shuffle (Fisher-Yates)
  const shuffleArray = (arr: any[]) => {
    const shuffled = [...arr];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  };

  const modules = modulesData;

  const currentModuleData = () => modules.find(m => m.id === currentModule());
  const currentLevelData = () => shuffledLevels()[currentLevel()];
  const totalLevels = () => shuffledLevels().length || 0;

  const handleAnswer = (index: number) => {
    if (showResult()) return;
    
    setSelectedAnswer(index);
    const isCorrect = index === currentLevelData()?.correct;
    
    if (isCorrect) {
      playSound('correct');
      setLastAnswer('correct');
      setScore(s => s + 100 + streak() * 10);
      setStreak(s => s + 1);
    } else {
      playSound('wrong');
      setLastAnswer('wrong');
      setStreak(0);
      setLives(l => Math.max(0, l - 1));
    }
    
    setShowResult(true);
  };

  const nextLevel = () => {
    if (currentLevel() < totalLevels() - 1) {
      setCurrentLevel(l => l + 1);
      setShowResult(false);
      setSelectedAnswer(null);
      setLastAnswer(null);
      playSound('click');
    } else {
      // Module complete
      playSound('levelup');
      setTotalProgress(p => p + 1);
      setCurrentModule(null);
      setCurrentLevel(0);
      setShowResult(false);
      setSelectedAnswer(null);
      setGameStarted(false);
    }
  };

  const startModule = (moduleId: string) => {
    playSound('click');
    const module = modules.find(m => m.id === moduleId);
    if (module) {
      setShuffledLevels(shuffleArray(module.levels));
    }
    setCurrentModule(moduleId);
    setCurrentLevel(0);
    setLives(3);
    setStreak(0);
    setShowResult(false);
    setSelectedAnswer(null);
    setGameStarted(true);
  };

  const exitGame = () => {
    playSound('click');
    setCurrentModule(null);
    setGameStarted(false);
  };

  // Main Menu
  const MainMenu = () => (
    <div class="space-y-4 animate-fade-in">
      {/* Stats Banner */}
      <div class="glass rounded-3xl p-5">
        <div class="flex items-center justify-between mb-4">
          <div>
            <p class="text-xs text-gray-500">{t('academy.progress')}</p>
            <p class="text-3xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
              {totalProgress()}/{modules.length}
            </p>
          </div>
          <div class="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-lg">
            <Icon name="trophy" class="text-white" size="lg" />
          </div>
        </div>
        <div class="h-2 bg-gray-200 rounded-full overflow-hidden">
          <div 
            class="h-full bg-gradient-to-r from-indigo-500 to-purple-600 rounded-full transition-all duration-500"
            style={`width: ${(totalProgress() / modules.length) * 100}%`}
          />
        </div>
        <div class="flex justify-between mt-2 text-xs text-gray-500">
          <span>{t('academy.points')}: {score()}</span>
          <span>{t('academy.completed')}: {totalProgress()}</span>
        </div>
      </div>

      {/* Sound Toggle */}
      <button 
        class="w-full glass rounded-2xl p-4 flex items-center justify-between touch-scale"
        onClick={() => { playSound('click'); setSoundEnabled(!soundEnabled()); }}
      >
        <div class="flex items-center gap-3">
          <Icon name={soundEnabled() ? 'volume2' : 'volumeX'} class="text-gray-600" size="sm" />
          <span class="font-medium text-gray-700">{t('academy.sound')}</span>
        </div>
        <div class={`w-12 h-7 rounded-full transition-all ${soundEnabled() ? 'bg-green-500' : 'bg-gray-300'}`}>
          <div class={`w-5 h-5 bg-white rounded-full shadow-md transform transition-all mt-1 ${soundEnabled() ? 'translate-x-6' : 'translate-x-1'}`} />
        </div>
      </button>

      {/* Professional Modules (by department) */}
      <div class="flex items-center gap-2 mb-1">
        <Icon name="graduationCap" size="sm" class="text-indigo-500" />
        <p class="font-semibold text-gray-800">{t('academy.professional')}</p>
      </div>
      <p class="text-xs text-gray-500 mb-3">{t('academy.professionalDesc')}</p>
      <div class="space-y-2.5 mb-6">
        <For each={professionalModules}>
          {(module, i) => {
            const dept = () => getDepartment((module as any).dept);
            return (
              <button
                class="w-full glass rounded-2xl p-4 text-left touch-scale animate-slide-up overflow-hidden relative"
                style={`animation-delay: ${i() * 0.03}s`}
                onClick={() => startModule(module.id)}
              >
                <div class={`absolute inset-0 bg-gradient-to-r ${module.color} opacity-5`} />
                <div class="flex items-center gap-3 relative">
                  <div class={`w-12 h-12 rounded-xl bg-gradient-to-br ${module.color} flex items-center justify-center shadow-md`}>
                    <SkillIcon icon={dept()?.icon || 'search'} class="text-white" size="sm" />
                  </div>
                  <div class="flex-1 min-w-0">
                    <p class="font-bold text-gray-800 text-sm truncate">{mName(module)}</p>
                    <p class="text-[10px] text-gray-400 truncate">{useRu() ? module.nameEn : module.name}</p>
                    <div class="flex items-center gap-1.5 mt-1">
                      <span class="text-[10px] px-1.5 py-0.5 bg-gray-100 rounded-full text-gray-600">
                        {module.levels.length} {t('academy.levels')}
                      </span>
                      <span class="text-[10px] px-1.5 py-0.5 bg-indigo-100 text-indigo-700 rounded-full">
                        ISO
                      </span>
                    </div>
                  </div>
                  <Icon name="chevronRight" class="text-gray-300" size="sm" />
                </div>
              </button>
            );
          }}
        </For>
      </div>

      {/* General Safety Modules */}
      <div class="flex items-center gap-2 mb-1">
        <Icon name="shieldCheck" size="sm" class="text-indigo-500" />
        <p class="font-semibold text-gray-800">{t('academy.general')}</p>
      </div>
      <p class="text-xs text-gray-500 mb-3">{t('academy.generalDesc')}</p>
      <div class="space-y-2.5">
        <For each={generalModules}>
          {(module, i) => (
            <button
              class="w-full glass rounded-2xl p-4 text-left touch-scale animate-slide-up overflow-hidden relative"
              style={`animation-delay: ${i() * 0.03}s`}
              onClick={() => startModule(module.id)}
            >
              <div class={`absolute inset-0 bg-gradient-to-r ${module.color} opacity-5`} />
              <div class="flex items-center gap-3 relative">
                <div class={`w-12 h-12 rounded-xl bg-gradient-to-br ${module.color} flex items-center justify-center shadow-md`}>
                  <Icon name={module.icon as keyof typeof Icons} class="text-white" size="lg" />
                </div>
                <div class="flex-1 min-w-0">
                  <p class="font-bold text-gray-800 text-sm truncate">{mName(module)}</p>
                  <p class="text-[10px] text-gray-400 truncate">{useRu() ? module.nameEn : module.name}</p>
                  <div class="flex items-center gap-1.5 mt-1">
                    <span class="text-[10px] px-1.5 py-0.5 bg-gray-100 rounded-full text-gray-600">
                      {module.levels.length} {t('academy.levels')}
                    </span>
                    <span class="text-[10px] px-1.5 py-0.5 bg-indigo-100 text-indigo-700 rounded-full">
                      ISO
                    </span>
                  </div>
                </div>
                <Icon name="chevronRight" class="text-gray-300" size="sm" />
              </div>
            </button>
          )}
        </For>
      </div>

      {/* Info Banner */}
      <div class="glass rounded-2xl p-4 border border-indigo-200 bg-indigo-50/30">
        <div class="flex items-start gap-3">
          <Icon name="globe" class="text-indigo-600" size="sm" />
          <div>
            <p class="font-medium text-indigo-800">{t('academy.standards')}</p>
            <p class="text-xs text-indigo-700 mt-1">
              {t('academy.standardsDesc')}
            </p>
          </div>
        </div>
      </div>
    </div>
  );

  // Game Screen
  // Helper: show Russian for Cyrillic-script langs, English for others
  const useRu = () => ['ru','uk','kk','ce','uz'].includes(currentLang());
  const qTitle = (l: any) => (!useRu() && l.titleEn) ? l.titleEn : l.title;
  const qQuestion = (l: any) => (!useRu() && l.questionEn) ? l.questionEn : l.question;
  const qOptions = (l: any) => (!useRu() && l.optionsEn) ? l.optionsEn : l.options;
  const qExplanation = (l: any) => (!useRu() && l.explanationEn) ? l.explanationEn : l.explanation;
  const mName = (m: any) => (!useRu() && m.nameEn) ? m.nameEn : m.name;

  const GameScreen = () => {
    const lv = () => currentLevelData();
    const md = () => currentModuleData();

    return (
      <div class="animate-fade-in">
        {/* Game Header */}
        <div class="glass rounded-3xl p-4 mb-4">
          <div class="flex items-center justify-between mb-3">
            <button 
              class="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center touch-scale"
              onClick={exitGame}
            >
              <Icon name="x" class="text-gray-600" size="sm" />
            </button>
            <div class="flex items-center gap-2">
              <For each={[...Array(3)]}>
                {(_, i) => (
                  <div class={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                    i() < lives() ? 'bg-red-500 scale-100' : 'bg-gray-200 scale-75'
                  }`}>
                    <Icon name="heart" class={i() < lives() ? 'text-white' : 'text-gray-400'} size="xs" />
                  </div>
                )}
              </For>
            </div>
            <div class="text-right">
              <p class="text-xs text-gray-500">{t('academy.points')}</p>
              <p class="font-bold text-indigo-600">{score()}</p>
            </div>
          </div>
          
          {/* Progress bar */}
          <div class="flex items-center gap-2">
            <span class="text-xs text-gray-500">{currentLevel() + 1}/{totalLevels()}</span>
            <div class="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
              <div 
                class={`h-full bg-gradient-to-r ${md()?.color || ''} rounded-full transition-all duration-500`}
                style={`width: ${((currentLevel() + 1) / totalLevels()) * 100}%`}
              />
            </div>
            <Show when={streak() > 0}>
              <span class="text-xs font-bold text-amber-500 flex items-center gap-1">
                <Icon name="zap" size="xs" /> x{streak()}
              </span>
            </Show>
          </div>
        </div>

        {/* Question Card — reactive via lv()/md() */}
        <Show when={lv()}>
          <div class="glass rounded-3xl overflow-hidden mb-4">
            <div class={`bg-gradient-to-r ${md()?.color || ''} p-4`}>
              <p class="text-white/90 text-sm">{md() ? mName(md()) : ''}</p>
              <p class="text-white font-bold text-lg">{lv() ? qTitle(lv()) : ''}</p>
            </div>

            <div class="p-5">
              <div class="text-6xl text-center mb-4 animate-bounce-gentle">{lv()!.image}</div>
              <p class="text-gray-800 font-medium text-center text-lg mb-6">{qQuestion(lv())}</p>

              <div class="space-y-3">
                <For each={qOptions(lv())}>
                  {(option, i) => {
                    const isSelected = () => selectedAnswer() === i();
                    const isCorrectOpt = () => i() === lv()!.correct;
                    const revealed = () => showResult();
                    
                    const bgClass = () => {
                      if (revealed()) {
                        if (isCorrectOpt()) return 'bg-green-100 ring-2 ring-green-500';
                        if (isSelected()) return 'bg-red-100 ring-2 ring-red-500';
                      } else if (isSelected()) {
                        return 'bg-indigo-100 ring-2 ring-indigo-500';
                      }
                      return 'bg-gray-50 hover:bg-gray-100';
                    };

                    return (
                      <button
                        class={`w-full p-4 rounded-2xl text-left transition-all touch-scale ${bgClass()}`}
                        onClick={() => handleAnswer(i())}
                        disabled={showResult()}
                      >
                        <div class="flex items-center gap-3">
                          <div class={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                            revealed() && isCorrectOpt() ? 'bg-green-500 text-white' :
                            revealed() && isSelected() ? 'bg-red-500 text-white' :
                            isSelected() ? 'bg-indigo-500 text-white' : 'bg-gray-200 text-gray-600'
                          }`}>
                            {revealed() && isCorrectOpt() ? '✓' : 
                             revealed() && isSelected() && !isCorrectOpt() ? '✗' : 
                             String.fromCharCode(65 + i())}
                          </div>
                          <span class={`flex-1 ${
                            revealed() && isCorrectOpt() ? 'text-green-700 font-medium' :
                            revealed() && isSelected() ? 'text-red-700' : 'text-gray-700'
                          }`}>
                            {option}
                          </span>
                        </div>
                      </button>
                    );
                  }}
                </For>
              </div>
            </div>
          </div>

          {/* Result */}
          <Show when={showResult()}>
            <div class={`glass rounded-3xl p-5 animate-slide-up ${
              lastAnswer() === 'correct' ? 'border-2 border-green-400 bg-green-50/50' : 'border-2 border-red-400 bg-red-50/50'
            }`}>
              <div class="flex items-center gap-3 mb-3">
                <div class={`w-12 h-12 rounded-full flex items-center justify-center ${
                  lastAnswer() === 'correct' ? 'bg-green-500' : 'bg-red-500'
                }`}>
                  <Icon name={lastAnswer() === 'correct' ? 'check' : 'x'} class="text-white" size="sm" />
                </div>
                <div>
                  <p class={`font-bold text-lg ${lastAnswer() === 'correct' ? 'text-green-700' : 'text-red-700'}`}>
                    {lastAnswer() === 'correct' ? t('academy.correct') : t('academy.wrong')}
                  </p>
                  <Show when={lastAnswer() === 'correct' && streak() > 1}>
                    <p class="text-amber-600 text-sm font-medium">{t('academy.streak')}: {streak()} 🔥</p>
                  </Show>
                </div>
              </div>
              
              <div class="p-3 bg-white/50 rounded-xl mb-4">
                <p class="text-sm text-gray-700">
                  <span class="font-medium">{t('academy.explanation')}: </span>
                  {qExplanation(lv())}
                </p>
              </div>

              <button 
                class={`w-full py-4 rounded-2xl font-bold text-white shadow-lg touch-scale ${
                  currentLevel() < totalLevels() - 1 
                    ? 'bg-gradient-to-r from-indigo-500 to-purple-600' 
                    : 'bg-gradient-to-r from-green-500 to-emerald-600'
                }`}
                onClick={nextLevel}
              >
                {currentLevel() < totalLevels() - 1 ? t('academy.next') : t('academy.finish')}
              </button>
            </div>
          </Show>
        </Show>

        {/* Game Over */}
        <Show when={lives() === 0}>
          <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 animate-fade-in">
            <div class="glass rounded-3xl p-6 m-4 text-center animate-slide-up">
              <div class="text-6xl mb-4">😢</div>
              <p class="text-2xl font-bold text-gray-800 mb-2">Игра окончена</p>
              <p class="text-gray-600 mb-4">Ваш счёт: {score()}</p>
              <button 
                class="w-full py-3 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-2xl font-bold touch-scale"
                onClick={() => { 
                  const m = currentModuleData();
                  if (m) setShuffledLevels(shuffleArray(m.levels));
                  setLives(3); setCurrentLevel(0); setScore(0); setShowResult(false); setSelectedAnswer(null); 
                }}
              >
                Попробовать снова
              </button>
              <button 
                class="w-full py-3 mt-2 glass rounded-2xl font-medium text-gray-700 touch-scale"
                onClick={exitGame}
              >
                Выйти в меню
              </button>
            </div>
          </div>
        </Show>
      </div>
    );
  };

  return (
    <div class="min-h-screen animate-fade-in pb-8">
      {/* Header */}
      <div class="p-4 flex items-center gap-4">
        <button 
          class="w-10 h-10 rounded-full glass flex items-center justify-center touch-scale"
          onClick={gameStarted() ? exitGame : props.onBack}
        >
          <Icon name="chevronLeft" class="text-gray-700" size="sm" />
        </button>
        <div>
          <h1 class="text-xl font-bold text-white">BOLH Academy</h1>
          <p class="text-white/90 text-sm">{t('academy.standards')}</p>
        </div>
      </div>

      <div class="px-4">
        <Show when={!gameStarted()}>
          <MainMenu />
        </Show>
        <Show when={gameStarted()}>
          <GameScreen />
        </Show>
      </div>
    </div>
  );
}
