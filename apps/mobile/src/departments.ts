// BOLH Multi-Profession Department System
// 11 departments, 135 skills, sorted easy → expert

/** 4th-level variant within a skill */
export interface SkillVariant {
  id: string;
  name: string;
  nameEn: string;
  icon: string;
}

export interface Skill {
  id: string;
  name: string;
  nameEn: string;
  icon: string; // emoji
  requiresDiploma: boolean;
  isExpert: boolean;
  urgent: boolean; // can be called urgently
  group?: string;    // sub-category key (e.g. 'moving', 'courier')
  groupName?: string;   // Russian group label
  groupNameEn?: string; // English group label
  groupIcon?: string;   // group emoji
  /** Expert can do this on your behalf */
  proxyAvailable?: boolean;
  /** Example proxy missions */
  proxyExamples?: string;
  proxyExamplesEn?: string;
  /** 4th-level variants (deeper drill-down) */
  variants?: SkillVariant[];
}

export interface Department {
  id: string;
  name: string;
  nameEn: string;
  icon: string; // emoji
  color: string; // tailwind gradient
  colorFrom: string;
  colorTo: string;
  accentBg: string;
  accentText: string;
  description: string;
  descriptionEn: string;
  workerTitle: string;
  workerTitleEn: string;
  skills: Skill[];
  /** Internship available in this department (always true) */
  internshipAvailable: boolean;
  /** Example intern role */
  internExample?: string;
  internExampleEn?: string;
}

export const departments: Department[] = [
  // ═══════════════════════════════════════
  // 1. САНТЕХНИКА / PLUMBING
  // ═══════════════════════════════════════
  {
    id: 'plumbing',
    name: 'Сантехника',
    nameEn: 'Plumbing',
    icon: '🔧',
    color: 'from-blue-500 to-cyan-600',
    colorFrom: '#3b82f6',
    colorTo: '#0891b2',
    accentBg: 'bg-blue-100',
    accentText: 'text-blue-700',
    description: 'Краны, трубы, засоры, монтаж',
    descriptionEn: 'Faucets, pipes, clogs, installation',
    workerTitle: 'Сантехник',
    workerTitleEn: 'Plumber',
    internshipAvailable: true,
    internExample: 'Стажёр-сантехник: монтаж, ремонт кранов',
    internExampleEn: 'Plumbing intern: installation, faucet repair',
    skills: [
      { id: 'plumb_general', name: 'Бытовой сантехник', nameEn: 'Household Plumber', icon: '🔧', requiresDiploma: false, isExpert: false, urgent: true, group: 'repair', groupName: 'Ремонт', groupNameEn: 'Repair', groupIcon: '🔧' },
      { id: 'plumb_clog', name: 'Засоры и канализация', nameEn: 'Clogs & Drainage', icon: '🚿', requiresDiploma: false, isExpert: false, urgent: true, group: 'repair', groupName: 'Ремонт', groupNameEn: 'Repair', groupIcon: '🔧' },
      { id: 'plumb_install', name: 'Монтаж сантехники', nameEn: 'Plumbing Installation', icon: '🚰', requiresDiploma: false, isExpert: false, urgent: false, group: 'install', groupName: 'Монтаж', groupNameEn: 'Installation', groupIcon: '🚰', variants: [
        { id: 'plumb_install_sink', name: 'Раковина / Мойка', nameEn: 'Sink', icon: '🚰' },
        { id: 'plumb_install_toilet', name: 'Унитаз / Биде', nameEn: 'Toilet / Bidet', icon: '🚽' },
        { id: 'plumb_install_bath', name: 'Ванна / Душ', nameEn: 'Bath / Shower', icon: '🛁' },
        { id: 'plumb_install_pipes', name: 'Трубы', nameEn: 'Pipes', icon: '🔩' },
      ]},
      { id: 'plumb_appliance', name: 'Подключение техники', nameEn: 'Appliance Connection', icon: '🧺', requiresDiploma: false, isExpert: false, urgent: false, group: 'install', groupName: 'Монтаж', groupNameEn: 'Installation', groupIcon: '🚰' },
      { id: 'plumb_boiler', name: 'Водонагреватели', nameEn: 'Water Heaters', icon: '🔥', requiresDiploma: false, isExpert: false, urgent: true, group: 'install', groupName: 'Монтаж', groupNameEn: 'Installation', groupIcon: '🚰' },
      { id: 'plumb_expert', name: 'Экспертиза сантехники', nameEn: 'Plumbing Expert Assessment', icon: '🔍', requiresDiploma: false, isExpert: true, urgent: false, group: 'expert', groupName: 'Эксперт', groupNameEn: 'Expert', groupIcon: '🔍', proxyAvailable: true, proxyExamples: 'Осмотреть трубы и канализацию перед покупкой квартиры', proxyExamplesEn: 'Inspect plumbing before buying an apartment' },
    ]
  },

  // ═══════════════════════════════════════
  // 2. ЭЛЕКТРИКА / ELECTRICAL
  // ═══════════════════════════════════════
  {
    id: 'electrical',
    name: 'Электрика',
    nameEn: 'Electrical',
    icon: '⚡',
    color: 'from-amber-500 to-yellow-600',
    colorFrom: '#f59e0b',
    colorTo: '#ca8a04',
    accentBg: 'bg-amber-100',
    accentText: 'text-amber-700',
    description: 'Розетки, свет, кондиционеры',
    descriptionEn: 'Outlets, lighting, AC',
    workerTitle: 'Электрик',
    workerTitleEn: 'Electrician',
    internshipAvailable: true,
    internExample: 'Стажёр-электрик: проводка, розетки, щитки',
    internExampleEn: 'Electrician intern: wiring, outlets, panels',
    skills: [
      { id: 'elec_general', name: 'Бытовой электрик', nameEn: 'Household Electrician', icon: '⚡', requiresDiploma: true, isExpert: false, urgent: true, group: 'repair', groupName: 'Ремонт', groupNameEn: 'Repair', groupIcon: '⚡' },
      { id: 'elec_ac', name: 'Кондиционеры и вентиляция', nameEn: 'AC & Ventilation', icon: '❄️', requiresDiploma: false, isExpert: false, urgent: true, group: 'climate', groupName: 'Климат', groupNameEn: 'Climate', groupIcon: '❄️', variants: [
        { id: 'elec_ac_install', name: 'Установка', nameEn: 'Installation', icon: '🔧' },
        { id: 'elec_ac_repair', name: 'Ремонт', nameEn: 'Repair', icon: '🔩' },
        { id: 'elec_ac_clean', name: 'Чистка', nameEn: 'Cleaning', icon: '✨' },
        { id: 'elec_ac_refill', name: 'Заправка фреона', nameEn: 'Freon refill', icon: '💨' },
      ]},
      { id: 'elec_wiring', name: 'Электропроводка', nameEn: 'Wiring', icon: '🔌', requiresDiploma: true, isExpert: false, urgent: false, group: 'install', groupName: 'Монтаж', groupNameEn: 'Installation', groupIcon: '🔌' },
      { id: 'elec_lighting', name: 'Установка освещения', nameEn: 'Lighting Installation', icon: '💡', requiresDiploma: false, isExpert: false, urgent: false, group: 'install', groupName: 'Монтаж', groupNameEn: 'Installation', groupIcon: '🔌' },
      { id: 'elec_expert', name: 'Проверка электробезопасности', nameEn: 'Electrical Safety Check', icon: '🔍', requiresDiploma: true, isExpert: true, urgent: false, group: 'expert', groupName: 'Эксперт', groupNameEn: 'Expert', groupIcon: '🔍', proxyAvailable: true, proxyExamples: 'Проверить проводку перед покупкой дома', proxyExamplesEn: 'Check wiring before buying a property' },
    ]
  },

  // ═══════════════════════════════════════
  // 3. ЗАМКИ И ДВЕРИ / LOCKS & DOORS
  // ═══════════════════════════════════════
  {
    id: 'locks',
    name: 'Замки и двери',
    nameEn: 'Locks & Doors',
    icon: '🔑',
    color: 'from-slate-500 to-gray-700',
    colorFrom: '#64748b',
    colorTo: '#374151',
    accentBg: 'bg-slate-100',
    accentText: 'text-slate-700',
    description: 'Вскрытие, замена, ремонт',
    descriptionEn: 'Lockout, replacement, repair',
    workerTitle: 'Мастер замков',
    workerTitleEn: 'Locksmith',
    internshipAvailable: true,
    internExample: 'Стажёр-замочник: установка, вскрытие, сейфы',
    internExampleEn: 'Locksmith intern: installation, opening, safes',
    skills: [
      { id: 'lock_open', name: 'Вскрытие замков', nameEn: 'Lock Opening', icon: '🔓', requiresDiploma: false, isExpert: false, urgent: true, group: 'emergency', groupName: 'Экстренное', groupNameEn: 'Emergency', groupIcon: '🔓' },
      { id: 'lock_install', name: 'Установка замков', nameEn: 'Lock Installation', icon: '🔐', requiresDiploma: false, isExpert: false, urgent: false, group: 'install', groupName: 'Установка', groupNameEn: 'Installation', groupIcon: '🔐' },
      { id: 'lock_door', name: 'Ремонт дверей и петель', nameEn: 'Door & Hinge Repair', icon: '🚪', requiresDiploma: false, isExpert: false, urgent: false, group: 'install', groupName: 'Установка', groupNameEn: 'Installation', groupIcon: '🔐' },
      { id: 'lock_furniture', name: 'Мебельная фурнитура', nameEn: 'Furniture Hardware', icon: '🪑', requiresDiploma: false, isExpert: false, urgent: false, group: 'install', groupName: 'Установка', groupNameEn: 'Installation', groupIcon: '🔐' },
      { id: 'lock_expert', name: 'Оценка безопасности двери', nameEn: 'Door Security Assessment', icon: '🔍', requiresDiploma: false, isExpert: true, urgent: false, group: 'expert', groupName: 'Эксперт', groupNameEn: 'Expert', groupIcon: '🔍', proxyAvailable: true, proxyExamples: 'Проверить замки и двери перед арендой', proxyExamplesEn: 'Check locks and doors before renting' },
    ]
  },

  // ═══════════════════════════════════════
  // 4. РЕМОНТ ТЕХНИКИ / TECH REPAIR
  // ═══════════════════════════════════════
  {
    id: 'tech',
    name: 'Ремонт техники',
    nameEn: 'Tech Repair',
    icon: '💻',
    color: 'from-sky-500 to-blue-700',
    colorFrom: '#0ea5e9',
    colorTo: '#7e22ce',
    accentBg: 'bg-sky-100',
    accentText: 'text-sky-700',
    description: 'Бытовая техника, ПК, телефоны',
    descriptionEn: 'Appliances, PC, phones',
    workerTitle: 'Мастер',
    workerTitleEn: 'Technician',
    internshipAvailable: true,
    internExample: 'Стажёр-техник: ремонт ПК, телефонов, сетей',
    internExampleEn: 'Tech intern: PC repair, phones, networks',
    skills: [
      { id: 'tech_appliance', name: 'Бытовая техника', nameEn: 'Home Appliances', icon: '🧊', requiresDiploma: false, isExpert: false, urgent: true, group: 'appliance', groupName: 'Бытовая', groupNameEn: 'Appliances', groupIcon: '🧊' },
      { id: 'tech_small', name: 'Мелкая электроника', nameEn: 'Small Electronics', icon: '📻', requiresDiploma: false, isExpert: false, urgent: false, group: 'appliance', groupName: 'Бытовая', groupNameEn: 'Appliances', groupIcon: '🧊' },
      { id: 'tech_pc', name: 'Компьютеры и ноутбуки', nameEn: 'PC & Laptops', icon: '💻', requiresDiploma: false, isExpert: false, urgent: true, group: 'digital', groupName: 'Цифровая', groupNameEn: 'Digital', groupIcon: '💻', variants: [
        { id: 'tech_pc_repair', name: 'Ремонт ПК', nameEn: 'PC repair', icon: '🔧' },
        { id: 'tech_pc_upgrade', name: 'Апгрейд', nameEn: 'Upgrade', icon: '⬆️' },
        { id: 'tech_pc_software', name: 'Программы / ОС', nameEn: 'Software / OS', icon: '💿' },
        { id: 'tech_pc_virus', name: 'Вирусы / Защита', nameEn: 'Virus / Security', icon: '🛡️' },
        { id: 'tech_pc_data', name: 'Восстановление данных', nameEn: 'Data recovery', icon: '💾' },
      ]},
      { id: 'tech_phone', name: 'Телефоны и планшеты', nameEn: 'Phones & Tablets', icon: '📱', requiresDiploma: false, isExpert: false, urgent: false, group: 'digital', groupName: 'Цифровая', groupNameEn: 'Digital', groupIcon: '💻', variants: [
        { id: 'tech_phone_screen', name: 'Замена экрана', nameEn: 'Screen replacement', icon: '📱' },
        { id: 'tech_phone_battery', name: 'Замена батареи', nameEn: 'Battery replacement', icon: '🔋' },
        { id: 'tech_phone_water', name: 'После воды', nameEn: 'Water damage', icon: '💧' },
        { id: 'tech_phone_software', name: 'Прошивка', nameEn: 'Firmware / Software', icon: '⚙️' },
      ]},
      { id: 'tech_remote', name: 'Удалённая помощь', nameEn: 'Remote Assistance', icon: '🌐', requiresDiploma: false, isExpert: true, urgent: true, group: 'expert', groupName: 'Эксперт', groupNameEn: 'Expert', groupIcon: '🔍' },
      { id: 'tech_expert', name: 'Диагностика перед покупкой', nameEn: 'Pre-purchase Diagnosis', icon: '🔍', requiresDiploma: false, isExpert: true, urgent: false, group: 'expert', groupName: 'Эксперт', groupNameEn: 'Expert', groupIcon: '🔍', proxyAvailable: true, proxyExamples: 'Проверить ноутбук/телефон по объявлению, купить и доставить', proxyExamplesEn: 'Inspect, buy & deliver a laptop/phone from listing' },
    ]
  },

  // ═══════════════════════════════════════
  // 5. ДОМАШНИЙ МАСТЕР / HANDYMAN
  // ═══════════════════════════════════════
  {
    id: 'handyman',
    name: 'Домашний мастер',
    nameEn: 'Handyman',
    icon: '🏠',
    color: 'from-orange-500 to-red-600',
    colorFrom: '#f97316',
    colorTo: '#dc2626',
    accentBg: 'bg-orange-100',
    accentText: 'text-orange-700',
    description: 'Мелкий ремонт, мебель, отделка',
    descriptionEn: 'Small repairs, furniture, finishing',
    workerTitle: 'Мастер',
    workerTitleEn: 'Handyman',
    internshipAvailable: true,
    internExample: 'Стажёр-мастер: мебель, стены, мелкий ремонт',
    internExampleEn: 'Handyman intern: furniture, walls, small repairs',
    skills: [
      { id: 'handy_general', name: 'Мелкий ремонт', nameEn: 'Small Repairs', icon: '🔨', requiresDiploma: false, isExpert: false, urgent: true, group: 'repair', groupName: 'Ремонт', groupNameEn: 'Repair', groupIcon: '🔨' },
      { id: 'handy_furniture', name: 'Сборка мебели', nameEn: 'Furniture Assembly', icon: '🪑', requiresDiploma: false, isExpert: false, urgent: false, group: 'repair', groupName: 'Ремонт', groupNameEn: 'Repair', groupIcon: '🔨' },
      { id: 'handy_mount', name: 'Навеска и монтаж', nameEn: 'Mounting & Hanging', icon: '📺', requiresDiploma: false, isExpert: false, urgent: false, group: 'finishing', groupName: 'Отделка', groupNameEn: 'Finishing', groupIcon: '🎨' },
      { id: 'handy_paint', name: 'Покраска и отделка', nameEn: 'Painting & Finishing', icon: '🎨', requiresDiploma: false, isExpert: false, urgent: false, group: 'finishing', groupName: 'Отделка', groupNameEn: 'Finishing', groupIcon: '🎨', variants: [
        { id: 'handy_paint_walls', name: 'Стены', nameEn: 'Walls', icon: '🏠' },
        { id: 'handy_paint_ceiling', name: 'Потолок', nameEn: 'Ceiling', icon: '⬆️' },
        { id: 'handy_paint_wallpaper', name: 'Обои', nameEn: 'Wallpaper', icon: '🎭' },
        { id: 'handy_paint_decorative', name: 'Декоративная штукатурка', nameEn: 'Decorative plaster', icon: '✨' },
      ]},
      { id: 'handy_tile', name: 'Плитка и ламинат', nameEn: 'Tiles & Laminate', icon: '🧱', requiresDiploma: false, isExpert: false, urgent: false, group: 'finishing', groupName: 'Отделка', groupNameEn: 'Finishing', groupIcon: '🎨', variants: [
        { id: 'handy_tile_floor', name: 'Напольная плитка', nameEn: 'Floor tiles', icon: '🧱' },
        { id: 'handy_tile_wall', name: 'Настенная плитка', nameEn: 'Wall tiles', icon: '🔲' },
        { id: 'handy_tile_laminate', name: 'Ламинат / Паркет', nameEn: 'Laminate / Parquet', icon: '🪵' },
        { id: 'handy_tile_mosaic', name: 'Мозаика', nameEn: 'Mosaic', icon: '🎨' },
      ]},
      { id: 'handy_expert', name: 'Оценка квартиры/ремонта', nameEn: 'Apartment/Renovation Assessment', icon: '🔍', requiresDiploma: false, isExpert: true, urgent: false, group: 'expert', groupName: 'Эксперт', groupNameEn: 'Expert', groupIcon: '🔍', proxyAvailable: true, proxyExamples: 'Осмотреть квартиру, оценить ремонт, фото/видео отчёт', proxyExamplesEn: 'Inspect apartment, assess renovation, photo/video report' },
      { id: 'handy_control', name: 'Контроль качества работ', nameEn: 'Quality Control', icon: '✅', requiresDiploma: false, isExpert: true, urgent: false, group: 'expert', groupName: 'Эксперт', groupNameEn: 'Expert', groupIcon: '🔍' },
    ]
  },

  // ═══════════════════════════════════════
  // 6. КЛИНИНГ / CLEANING
  // ═══════════════════════════════════════
  {
    id: 'cleaning',
    name: 'Клининг',
    nameEn: 'Cleaning',
    icon: '🧹',
    color: 'from-emerald-500 to-teal-600',
    colorFrom: '#10b981',
    colorTo: '#0d9488',
    accentBg: 'bg-emerald-100',
    accentText: 'text-emerald-700',
    description: 'Уборка квартир, офисов, генеральная',
    descriptionEn: 'Homes, offices, deep cleaning',
    workerTitle: 'Клинер',
    workerTitleEn: 'Cleaner',
    internshipAvailable: true,
    internExample: 'Стажёр-клинер: уборка, химчистка, дезинфекция',
    internExampleEn: 'Cleaning intern: cleaning, dry cleaning, sanitation',
    skills: [
      // ── Регулярная (простое → сложное) ──
      { id: 'clean_home', name: 'Уборка квартир/домов', nameEn: 'Home Cleaning', icon: '🏠', requiresDiploma: false, isExpert: false, urgent: true, group: 'regular', groupName: 'Регулярная', groupNameEn: 'Regular', groupIcon: '🏠', variants: [
        { id: 'clean_home_1r', name: '1-комнатная', nameEn: '1-room', icon: '1️⃣' },
        { id: 'clean_home_2r', name: '2-комнатная', nameEn: '2-room', icon: '2️⃣' },
        { id: 'clean_home_3r', name: '3+ комнат', nameEn: '3+ rooms', icon: '3️⃣' },
        { id: 'clean_home_house', name: 'Частный дом', nameEn: 'House', icon: '🏡' },
      ]},
      { id: 'clean_office', name: 'Уборка офисов', nameEn: 'Office Cleaning', icon: '🏢', requiresDiploma: false, isExpert: false, urgent: false, group: 'regular', groupName: 'Регулярная', groupNameEn: 'Regular', groupIcon: '🏠', variants: [
        { id: 'clean_office_small', name: 'Малый офис', nameEn: 'Small office', icon: '🏠' },
        { id: 'clean_office_large', name: 'Большой офис', nameEn: 'Large office', icon: '🏢' },
        { id: 'clean_office_daily', name: 'Ежедневная', nameEn: 'Daily', icon: '📅' },
        { id: 'clean_office_warehouse', name: 'Склад / Производство', nameEn: 'Warehouse / Factory', icon: '🏭' },
      ]},
      // ── Специальная (простое → сложное) ──
      { id: 'clean_window', name: 'Мойка окон', nameEn: 'Window Cleaning', icon: '🪟', requiresDiploma: false, isExpert: false, urgent: false, group: 'special', groupName: 'Специальная', groupNameEn: 'Special', groupIcon: '✨' },
      { id: 'clean_deep', name: 'Генеральная уборка', nameEn: 'Deep Cleaning', icon: '✨', requiresDiploma: false, isExpert: false, urgent: false, group: 'special', groupName: 'Специальная', groupNameEn: 'Special', groupIcon: '✨' },
      { id: 'clean_chem', name: 'Химчистка мебели/ковров', nameEn: 'Upholstery/Carpet Cleaning', icon: '🛋️', requiresDiploma: false, isExpert: false, urgent: false, group: 'special', groupName: 'Специальная', groupNameEn: 'Special', groupIcon: '✨' },
      { id: 'clean_after', name: 'Уборка после ремонта', nameEn: 'Post-renovation Cleanup', icon: '🧹', requiresDiploma: false, isExpert: false, urgent: false, group: 'special', groupName: 'Специальная', groupNameEn: 'Special', groupIcon: '✨' },
      // ── Эксперт ──
      { id: 'clean_expert', name: 'Экспертиза чистоты и дезинфекции', nameEn: 'Cleaning & Sanitation Expert', icon: '🔍', requiresDiploma: false, isExpert: true, urgent: false, group: 'expert', groupName: 'Эксперт', groupNameEn: 'Expert', groupIcon: '🔍', proxyAvailable: true, proxyExamples: 'Проверить чистоту перед арендой или покупкой', proxyExamplesEn: 'Inspect cleanliness before renting or buying' },
    ]
  },

  // ═══════════════════════════════════════
  // 7. ПЕРЕЕЗД И ДОСТАВКА / MOVING & DELIVERY
  // ═══════════════════════════════════════
  {
    id: 'moving',
    name: 'Переезд и доставка',
    nameEn: 'Moving & Delivery',
    icon: '🚚',
    color: 'from-rose-500 to-red-700',
    colorFrom: '#f43f5e',
    colorTo: '#b91c1c',
    accentBg: 'bg-rose-100',
    accentText: 'text-rose-700',
    description: 'Грузчики, курьеры, перевозка',
    descriptionEn: 'Movers, couriers, transport',
    workerTitle: 'Грузчик / Курьер',
    workerTitleEn: 'Mover / Courier',
    internshipAvailable: true,
    internExample: 'Стажёр-курьер: доставка, логистика, маршруты',
    internExampleEn: 'Courier intern: delivery, logistics, routes',
    skills: [
      // ── Переезд ──
      { id: 'move_loader', name: 'Грузчики', nameEn: 'Movers', icon: '💪', requiresDiploma: false, isExpert: false, urgent: true, group: 'moving', groupName: 'Переезд', groupNameEn: 'Moving', groupIcon: '🚚', variants: [
        { id: 'move_loader_1', name: '1 грузчик', nameEn: '1 mover', icon: '👤' },
        { id: 'move_loader_2', name: '2 грузчика', nameEn: '2 movers', icon: '👥' },
        { id: 'move_loader_team', name: 'Бригада 3+', nameEn: 'Team 3+', icon: '👷' },
      ]},
      { id: 'move_furniture', name: 'Перевозка мебели', nameEn: 'Furniture Moving', icon: '🛋️', requiresDiploma: false, isExpert: false, urgent: false, group: 'moving', groupName: 'Переезд', groupNameEn: 'Moving', groupIcon: '🚚', variants: [
        { id: 'move_furniture_small', name: 'Малая мебель', nameEn: 'Small furniture', icon: '🪑' },
        { id: 'move_furniture_large', name: 'Крупная мебель', nameEn: 'Large furniture', icon: '🛋️' },
        { id: 'move_furniture_piano', name: 'Пианино / Сейф', nameEn: 'Piano / Safe', icon: '🎹' },
      ]},
      { id: 'move_trash', name: 'Вывоз мусора', nameEn: 'Waste Removal', icon: '🗑️', requiresDiploma: false, isExpert: false, urgent: false, group: 'moving', groupName: 'Переезд', groupNameEn: 'Moving', groupIcon: '🚚' },
      { id: 'move_pack', name: 'Упаковка вещей', nameEn: 'Packing', icon: '📋', requiresDiploma: false, isExpert: false, urgent: false, group: 'moving', groupName: 'Переезд', groupNameEn: 'Moving', groupIcon: '🚚' },
      // ── Курьеры ──
      { id: 'del_foot', name: 'Курьер пешком', nameEn: 'On Foot Courier', icon: '🚶', requiresDiploma: false, isExpert: false, urgent: true, group: 'courier', groupName: 'Курьеры', groupNameEn: 'Couriers', groupIcon: '🏃' },
      { id: 'del_bike', name: 'Велокурьер', nameEn: 'Bicycle Courier', icon: '🚲', requiresDiploma: false, isExpert: false, urgent: true, group: 'courier', groupName: 'Курьеры', groupNameEn: 'Couriers', groupIcon: '🏃' },
      { id: 'del_moto', name: 'Мотокурьер', nameEn: 'Motorcycle Courier', icon: '🏍️', requiresDiploma: false, isExpert: false, urgent: true, group: 'courier', groupName: 'Курьеры', groupNameEn: 'Couriers', groupIcon: '🏃' },
      { id: 'del_car', name: 'Авто доставка', nameEn: 'Car Delivery', icon: '🚗', requiresDiploma: false, isExpert: false, urgent: false, group: 'courier', groupName: 'Курьеры', groupNameEn: 'Couriers', groupIcon: '🏃' },
      { id: 'del_van', name: 'Минивэн', nameEn: 'Minivan', icon: '🚐', requiresDiploma: false, isExpert: false, urgent: false, group: 'courier', groupName: 'Курьеры', groupNameEn: 'Couriers', groupIcon: '🏃' },
      { id: 'del_truck', name: 'Грузовик', nameEn: 'Truck', icon: '🚛', requiresDiploma: false, isExpert: false, urgent: false, group: 'courier', groupName: 'Курьеры', groupNameEn: 'Couriers', groupIcon: '🏃' },
      { id: 'del_special', name: 'Хрупкое / Медицина', nameEn: 'Fragile / Medical', icon: '🔬', requiresDiploma: false, isExpert: true, urgent: true, group: 'courier', groupName: 'Курьеры', groupNameEn: 'Couriers', groupIcon: '🏃' },
      { id: 'del_inter', name: 'Международная доставка', nameEn: 'International Delivery', icon: '✈️', requiresDiploma: false, isExpert: false, urgent: false, group: 'courier', groupName: 'Курьеры', groupNameEn: 'Couriers', groupIcon: '🏃' },
      // ── Эксперты ──
      { id: 'move_expert', name: 'Планирование переезда', nameEn: 'Moving Planning', icon: '🔍', requiresDiploma: false, isExpert: true, urgent: false, group: 'expert', groupName: 'Эксперт', groupNameEn: 'Expert', groupIcon: '🔍', proxyAvailable: true, proxyExamples: 'Организовать переезд — эксперт спланирует и проведёт всё', proxyExamplesEn: 'Plan and manage the entire relocation' },
      { id: 'del_expert', name: 'Доставка + Установка', nameEn: 'Delivery + Installation', icon: '👨‍🔧', requiresDiploma: false, isExpert: true, urgent: false, group: 'expert', groupName: 'Эксперт', groupNameEn: 'Expert', groupIcon: '🔍', proxyAvailable: true, proxyExamples: 'Забрать технику, доставить и установить у вас дома', proxyExamplesEn: 'Pick up appliance, deliver and install at your home' },
    ]
  },

  // ═══════════════════════════════════════
  // 8. ОХРАНА И БЕЗОПАСНОСТЬ / SECURITY
  // ═══════════════════════════════════════
  {
    id: 'security',
    name: 'Охрана',
    nameEn: 'Security',
    icon: '🛡️',
    color: 'from-sky-500 to-blue-600',
    colorFrom: '#0ea5e9',
    colorTo: '#1d4ed8',
    accentBg: 'bg-sky-100',
    accentText: 'text-sky-700',
    description: 'Личная охрана, объекты, сопровождение',
    descriptionEn: 'Personal guard, facility, escort',
    workerTitle: 'Охранник',
    workerTitleEn: 'Guard',
    internshipAvailable: true,
    internExample: 'Стажёр-охранник: видеонаблюдение, патруль',
    internExampleEn: 'Security intern: CCTV, patrol, monitoring',
    skills: [
      // ── Охрана (простое → сложное) ──
      { id: 'sec_escort', name: 'Сопровождение', nameEn: 'Escort Service', icon: '🚶', requiresDiploma: false, isExpert: false, urgent: true, group: 'guard', groupName: 'Охрана', groupNameEn: 'Guard', groupIcon: '🛡️' },
      { id: 'sec_urgent', name: 'Срочный выезд', nameEn: 'Emergency Dispatch', icon: '🚨', requiresDiploma: false, isExpert: false, urgent: true, group: 'guard', groupName: 'Охрана', groupNameEn: 'Guard', groupIcon: '🛡️' },
      { id: 'sec_facility', name: 'Охрана объектов', nameEn: 'Facility Security', icon: '🏢', requiresDiploma: true, isExpert: false, urgent: false, group: 'guard', groupName: 'Охрана', groupNameEn: 'Guard', groupIcon: '🛡️' },
      { id: 'sec_personal', name: 'Личная охрана', nameEn: 'Personal Guard', icon: '🛡️', requiresDiploma: true, isExpert: false, urgent: true, group: 'guard', groupName: 'Охрана', groupNameEn: 'Guard', groupIcon: '🛡️' },
      // ── Эксперт ──
      { id: 'sec_consult', name: 'Консультация по защите', nameEn: 'Protection Consulting', icon: '📋', requiresDiploma: false, isExpert: true, urgent: false, group: 'expert', groupName: 'Эксперт', groupNameEn: 'Expert', groupIcon: '🔍', proxyAvailable: true, proxyExamples: 'Консультация и рекомендации по защите', proxyExamplesEn: 'Security consulting and recommendations' },
      { id: 'sec_expert', name: 'Оценка безопасности объекта', nameEn: 'Security Assessment', icon: '🔍', requiresDiploma: true, isExpert: true, urgent: false, group: 'expert', groupName: 'Эксперт', groupNameEn: 'Expert', groupIcon: '🔍', proxyAvailable: true, proxyExamples: 'Проверить безопасность дома/офиса перед покупкой/арендой', proxyExamplesEn: 'Assess security of a property before purchase/rental' },
    ]
  },

  // ═══════════════════════════════════════
  // 9. АВТО И ГАРАЖ / AUTO & GARAGE
  // ═══════════════════════════════════════
  {
    id: 'auto',
    name: 'Авто и гараж',
    nameEn: 'Auto & Garage',
    icon: '🚗',
    color: 'from-zinc-600 to-stone-800',
    colorFrom: '#52525b',
    colorTo: '#292524',
    accentBg: 'bg-zinc-100',
    accentText: 'text-zinc-700',
    description: 'Механик, буксир, шиномонтаж',
    descriptionEn: 'Mechanic, towing, tire service',
    workerTitle: 'Механик',
    workerTitleEn: 'Mechanic',
    internshipAvailable: true,
    internExample: 'Стажёр-автомеханик: диагностика, ремонт, шины',
    internExampleEn: 'Auto mechanic intern: diagnostics, repair, tires',
    skills: [
      // ── Сервис (простое → сложное) ──
      { id: 'auto_wash', name: 'Мойка авто', nameEn: 'Car Wash', icon: '🧽', requiresDiploma: false, isExpert: false, urgent: false, group: 'service', groupName: 'Сервис', groupNameEn: 'Service', groupIcon: '🚗', variants: [
        { id: 'auto_wash_basic', name: 'Стандартная мойка', nameEn: 'Standard wash', icon: '💦' },
        { id: 'auto_wash_full', name: 'Полная мойка', nameEn: 'Full wash', icon: '✨' },
        { id: 'auto_wash_detail', name: 'Детейлинг', nameEn: 'Detailing', icon: '💎' },
        { id: 'auto_wash_dry', name: 'Химчистка салона', nameEn: 'Interior dry clean', icon: '🧹' },
      ]},
      { id: 'auto_tire', name: 'Шиномонтаж', nameEn: 'Tire Service', icon: '🛞', requiresDiploma: false, isExpert: false, urgent: true, group: 'service', groupName: 'Сервис', groupNameEn: 'Service', groupIcon: '🚗', variants: [
        { id: 'auto_tire_change', name: 'Замена колёс', nameEn: 'Tire change', icon: '🔄' },
        { id: 'auto_tire_repair', name: 'Ремонт прокола', nameEn: 'Puncture repair', icon: '🩹' },
        { id: 'auto_tire_balance', name: 'Балансировка', nameEn: 'Balancing', icon: '⚖️' },
        { id: 'auto_tire_align', name: 'Развал-схождение', nameEn: 'Alignment', icon: '📐' },
      ]},
      { id: 'auto_tow', name: 'Буксир / Эвакуатор', nameEn: 'Towing / Recovery', icon: '🚛', requiresDiploma: false, isExpert: false, urgent: true, group: 'service', groupName: 'Сервис', groupNameEn: 'Service', groupIcon: '🚗' },
      // ── Механика (простое → сложное) ──
      { id: 'auto_mobile', name: 'Механик на выезд', nameEn: 'Mobile Mechanic', icon: '🔧', requiresDiploma: false, isExpert: false, urgent: true, group: 'mechanic', groupName: 'Механика', groupNameEn: 'Mechanic', groupIcon: '🔧', variants: [
        { id: 'auto_mobile_battery', name: 'Аккумулятор', nameEn: 'Battery', icon: '🔋' },
        { id: 'auto_mobile_start', name: 'Не заводится', nameEn: 'Won\'t start', icon: '🔑' },
        { id: 'auto_mobile_oil', name: 'Масло / Жидкости', nameEn: 'Oil / Fluids', icon: '🛢️' },
        { id: 'auto_mobile_lock', name: 'Заблокировался', nameEn: 'Locked out', icon: '🔒' },
      ]},
      { id: 'auto_electric', name: 'Автоэлектрик', nameEn: 'Auto Electrician', icon: '⚡', requiresDiploma: false, isExpert: false, urgent: true, group: 'mechanic', groupName: 'Механика', groupNameEn: 'Mechanic', groupIcon: '🔧' },
      { id: 'auto_garage', name: 'Механик с гаражом', nameEn: 'Garage Mechanic', icon: '🏗️', requiresDiploma: false, isExpert: false, urgent: false, group: 'mechanic', groupName: 'Механика', groupNameEn: 'Mechanic', groupIcon: '🔧', variants: [
        { id: 'auto_garage_engine', name: 'Двигатель', nameEn: 'Engine', icon: '⚙️' },
        { id: 'auto_garage_trans', name: 'Коробка передач', nameEn: 'Transmission', icon: '🔄' },
        { id: 'auto_garage_brakes', name: 'Тормоза', nameEn: 'Brakes', icon: '🛑' },
        { id: 'auto_garage_suspension', name: 'Подвеска', nameEn: 'Suspension', icon: '🔩' },
        { id: 'auto_garage_exhaust', name: 'Выхлопная система', nameEn: 'Exhaust', icon: '💨' },
        { id: 'auto_garage_ac', name: 'Кондиционер', nameEn: 'AC / Climate', icon: '❄️' },
      ]},
      // ── Эксперт ──
      { id: 'auto_diag', name: 'Диагностика', nameEn: 'Diagnostics', icon: '📊', requiresDiploma: false, isExpert: true, urgent: false, group: 'expert', groupName: 'Эксперт', groupNameEn: 'Expert', groupIcon: '🔍', proxyAvailable: true, proxyExamples: 'Компьютерная диагностика авто в другом городе', proxyExamplesEn: 'Remote car diagnostics in another city' },
      { id: 'auto_expert', name: 'Проверка авто перед покупкой', nameEn: 'Pre-purchase Car Inspection', icon: '🔍', requiresDiploma: false, isExpert: true, urgent: false, group: 'expert', groupName: 'Эксперт', groupNameEn: 'Expert', groupIcon: '🔍', proxyAvailable: true, proxyExamples: 'Осмотреть, купить, застраховать и пригнать/эвакуировать авто', proxyExamplesEn: 'Inspect, buy, insure & deliver/tow a car for you' },
    ]
  },

  // ═══════════════════════════════════════
  // 10. АРЕНДА / RENTAL
  // ═══════════════════════════════════════
  {
    id: 'rental',
    name: 'Аренда',
    nameEn: 'Rental',
    icon: '🔑',
    color: 'from-teal-500 to-cyan-600',
    colorFrom: '#14b8a6',
    colorTo: '#0891b2',
    accentBg: 'bg-teal-100',
    accentText: 'text-teal-700',
    description: 'Жильё, авто, инструменты, техника, всё',
    descriptionEn: 'Housing, cars, tools, equipment, anything',
    workerTitle: 'Арендодатель',
    workerTitleEn: 'Landlord',
    internshipAvailable: true,
    internExample: 'Стажёр: оценка техники, аренда, страхование',
    internExampleEn: 'Rental intern: appraisal, leasing, insurance',
    skills: [
      // ── Транспорт ──
      { id: 'rent_car', name: 'Автомобиль', nameEn: 'Car', icon: '🚗', requiresDiploma: false, isExpert: false, urgent: false, group: 'transport', groupName: 'Транспорт', groupNameEn: 'Transport', groupIcon: '🚗', variants: [
        { id: 'rent_car_sedan', name: 'Седан', nameEn: 'Sedan', icon: '🚗' },
        { id: 'rent_car_suv', name: 'Внедорожник / Кроссовер', nameEn: 'SUV / Crossover', icon: '🚙' },
        { id: 'rent_car_van', name: 'Минивэн / Фургон', nameEn: 'Van / Minivan', icon: '🚐' },
        { id: 'rent_car_truck', name: 'Пикап / Грузовик', nameEn: 'Pickup / Truck', icon: '🛻' },
        { id: 'rent_car_luxury', name: 'Люкс / Спорт', nameEn: 'Luxury / Sport', icon: '🏎️' },
        { id: 'rent_car_electric', name: 'Электромобиль', nameEn: 'Electric', icon: '⚡' },
      ]},
      { id: 'rent_moto', name: 'Мотоцикл / Скутер', nameEn: 'Motorcycle / Scooter', icon: '🏍️', requiresDiploma: false, isExpert: false, urgent: false, group: 'transport', groupName: 'Транспорт', groupNameEn: 'Transport', groupIcon: '🚗' },
      { id: 'rent_bike', name: 'Велосипед / Самокат', nameEn: 'Bicycle / Kick scooter', icon: '🚲', requiresDiploma: false, isExpert: false, urgent: false, group: 'transport', groupName: 'Транспорт', groupNameEn: 'Transport', groupIcon: '🚗' },
      { id: 'rent_boat', name: 'Лодка / Катер', nameEn: 'Boat', icon: '⛵', requiresDiploma: false, isExpert: false, urgent: false, group: 'transport', groupName: 'Транспорт', groupNameEn: 'Transport', groupIcon: '🚗' },
      { id: 'rent_trailer', name: 'Прицеп', nameEn: 'Trailer', icon: '🚛', requiresDiploma: false, isExpert: false, urgent: false, group: 'transport', groupName: 'Транспорт', groupNameEn: 'Transport', groupIcon: '🚗' },
      // ── Инструменты ──
      { id: 'rent_power', name: 'Электроинструмент', nameEn: 'Power Tools', icon: '🔌', requiresDiploma: false, isExpert: false, urgent: false, group: 'tools', groupName: 'Инструменты', groupNameEn: 'Tools', groupIcon: '🛠️', variants: [
        { id: 'rent_power_drill', name: 'Дрель / Перфоратор', nameEn: 'Drill / Hammer drill', icon: '🔩' },
        { id: 'rent_power_saw', name: 'Пила / Болгарка', nameEn: 'Saw / Grinder', icon: '⚙️' },
        { id: 'rent_power_sander', name: 'Шлифовальная', nameEn: 'Sander', icon: '🪵' },
        { id: 'rent_power_welder', name: 'Сварочный аппарат', nameEn: 'Welder', icon: '🔥' },
        { id: 'rent_power_compressor', name: 'Компрессор', nameEn: 'Compressor', icon: '💨' },
      ]},
      { id: 'rent_garden', name: 'Газонокосилки / Сад', nameEn: 'Lawnmower / Garden', icon: '🌿', requiresDiploma: false, isExpert: false, urgent: false, group: 'tools', groupName: 'Инструменты', groupNameEn: 'Tools', groupIcon: '🛠️' },
      { id: 'rent_construct', name: 'Стройоборудование', nameEn: 'Construction Equipment', icon: '🏗️', requiresDiploma: false, isExpert: false, urgent: false, group: 'tools', groupName: 'Инструменты', groupNameEn: 'Tools', groupIcon: '🛠️' },
      { id: 'rent_clean_eq', name: 'Клининговое оборудование', nameEn: 'Cleaning Equipment', icon: '🧹', requiresDiploma: false, isExpert: false, urgent: false, group: 'tools', groupName: 'Инструменты', groupNameEn: 'Tools', groupIcon: '🛠️' },
      { id: 'rent_generator', name: 'Генератор', nameEn: 'Generator', icon: '⚡', requiresDiploma: false, isExpert: false, urgent: true, group: 'tools', groupName: 'Инструменты', groupNameEn: 'Tools', groupIcon: '🛠️' },
      // ── Электроника ──
      { id: 'rent_camera', name: 'Камера / Объектив', nameEn: 'Camera / Lens', icon: '📷', requiresDiploma: false, isExpert: false, urgent: false, group: 'electronics', groupName: 'Электроника', groupNameEn: 'Electronics', groupIcon: '📷', variants: [
        { id: 'rent_camera_photo', name: 'Фотоаппарат', nameEn: 'Photo camera', icon: '📸' },
        { id: 'rent_camera_video', name: 'Видеокамера', nameEn: 'Video camera', icon: '🎥' },
        { id: 'rent_camera_lens', name: 'Объектив', nameEn: 'Lens', icon: '🔭' },
        { id: 'rent_camera_drone', name: 'Дрон с камерой', nameEn: 'Camera drone', icon: '🛸' },
        { id: 'rent_camera_action', name: 'Экшн-камера', nameEn: 'Action camera', icon: '📹' },
      ]},
      { id: 'rent_projector', name: 'Проектор / Экран', nameEn: 'Projector / Screen', icon: '📽️', requiresDiploma: false, isExpert: false, urgent: false, group: 'electronics', groupName: 'Электроника', groupNameEn: 'Electronics', groupIcon: '📷' },
      { id: 'rent_sound', name: 'Звук / Колонки / DJ', nameEn: 'Sound / Speakers / DJ', icon: '🎵', requiresDiploma: false, isExpert: false, urgent: false, group: 'electronics', groupName: 'Электроника', groupNameEn: 'Electronics', groupIcon: '📷' },
      { id: 'rent_gaming', name: 'Игровые консоли / VR', nameEn: 'Gaming / VR', icon: '🎮', requiresDiploma: false, isExpert: false, urgent: false, group: 'electronics', groupName: 'Электроника', groupNameEn: 'Electronics', groupIcon: '📷' },
      // ── Жильё / Property ──
      { id: 'rent_apartment', name: 'Квартира', nameEn: 'Apartment', icon: '🏠', requiresDiploma: false, isExpert: false, urgent: false, group: 'property', groupName: 'Жильё', groupNameEn: 'Property', groupIcon: '🏘️', variants: [
        { id: 'rent_apartment_studio', name: 'Студия', nameEn: 'Studio', icon: '🪟' },
        { id: 'rent_apartment_1r', name: '1-комнатная', nameEn: '1-bedroom', icon: '1️⃣' },
        { id: 'rent_apartment_2r', name: '2-комнатная', nameEn: '2-bedroom', icon: '2️⃣' },
        { id: 'rent_apartment_3r', name: '3-комнатная', nameEn: '3-bedroom', icon: '3️⃣' },
        { id: 'rent_apartment_4plus', name: '4+ комнат', nameEn: '4+ bedroom', icon: '4️⃣' },
        { id: 'rent_apartment_penthouse', name: 'Пентхаус', nameEn: 'Penthouse', icon: '🌆' },
      ]},
      { id: 'rent_room', name: 'Комната', nameEn: 'Room', icon: '🛏️', requiresDiploma: false, isExpert: false, urgent: false, group: 'property', groupName: 'Жильё', groupNameEn: 'Property', groupIcon: '🏘️' },
      { id: 'rent_house', name: 'Дом / Коттедж', nameEn: 'House / Cottage', icon: '🏡', requiresDiploma: false, isExpert: false, urgent: false, group: 'property', groupName: 'Жильё', groupNameEn: 'Property', groupIcon: '🏘️', variants: [
        { id: 'rent_house_small', name: 'Малый дом', nameEn: 'Small house', icon: '🏠' },
        { id: 'rent_house_cottage', name: 'Коттедж', nameEn: 'Cottage', icon: '🏡' },
        { id: 'rent_house_townhouse', name: 'Таунхаус', nameEn: 'Townhouse', icon: '🏘️' },
        { id: 'rent_house_country', name: 'Загородный дом', nameEn: 'Country house', icon: '🌲' },
      ]},
      { id: 'rent_villa', name: 'Вилла / Особняк', nameEn: 'Villa / Mansion', icon: '🏰', requiresDiploma: false, isExpert: false, urgent: false, group: 'property', groupName: 'Жильё', groupNameEn: 'Property', groupIcon: '🏘️', variants: [
        { id: 'rent_villa_sea', name: 'У моря', nameEn: 'Seaside', icon: '🌊' },
        { id: 'rent_villa_mountain', name: 'В горах', nameEn: 'Mountain', icon: '🏔️' },
        { id: 'rent_villa_pool', name: 'С бассейном', nameEn: 'With pool', icon: '🏊' },
        { id: 'rent_villa_luxury', name: 'Люкс', nameEn: 'Luxury', icon: '💎' },
      ]},
      { id: 'rent_hotel', name: 'Гостиница / Отель', nameEn: 'Hotel', icon: '🏨', requiresDiploma: false, isExpert: false, urgent: true, group: 'property', groupName: 'Жильё', groupNameEn: 'Property', groupIcon: '🏘️', variants: [
        { id: 'rent_hotel_standard', name: 'Стандарт', nameEn: 'Standard', icon: '⭐' },
        { id: 'rent_hotel_comfort', name: 'Комфорт', nameEn: 'Comfort', icon: '⭐⭐' },
        { id: 'rent_hotel_suite', name: 'Люкс / Сьют', nameEn: 'Suite', icon: '👑' },
        { id: 'rent_hotel_apart', name: 'Апарт-отель', nameEn: 'Apart-hotel', icon: '🏢' },
      ]},
      { id: 'rent_hostel', name: 'Хостел', nameEn: 'Hostel', icon: '🛌', requiresDiploma: false, isExpert: false, urgent: false, group: 'property', groupName: 'Жильё', groupNameEn: 'Property', groupIcon: '🏘️' },
      { id: 'rent_dacha', name: 'Дача / Загородный дом', nameEn: 'Country House / Dacha', icon: '🌳', requiresDiploma: false, isExpert: false, urgent: false, group: 'property', groupName: 'Жильё', groupNameEn: 'Property', groupIcon: '🏘️' },
      { id: 'rent_glamping', name: 'Глэмпинг / Кемпинг', nameEn: 'Glamping / Camping', icon: '⛺', requiresDiploma: false, isExpert: false, urgent: false, group: 'property', groupName: 'Жильё', groupNameEn: 'Property', groupIcon: '🏘️' },
      // ── Пространства / Spaces ──
      { id: 'rent_space', name: 'Зал / Студия / Офис', nameEn: 'Hall / Studio / Office', icon: '🏢', requiresDiploma: false, isExpert: false, urgent: false, group: 'space', groupName: 'Пространства', groupNameEn: 'Spaces', groupIcon: '🏢' },
      { id: 'rent_cowork', name: 'Коворкинг', nameEn: 'Coworking Space', icon: '💻', requiresDiploma: false, isExpert: false, urgent: false, group: 'space', groupName: 'Пространства', groupNameEn: 'Spaces', groupIcon: '🏢' },
      { id: 'rent_event', name: 'Площадка для мероприятий', nameEn: 'Event Venue', icon: '🎪', requiresDiploma: false, isExpert: false, urgent: false, group: 'space', groupName: 'Пространства', groupNameEn: 'Spaces', groupIcon: '🏢' },
      { id: 'rent_photo_studio', name: 'Фотостудия', nameEn: 'Photo Studio', icon: '📸', requiresDiploma: false, isExpert: false, urgent: false, group: 'space', groupName: 'Пространства', groupNameEn: 'Spaces', groupIcon: '🏢' },
      { id: 'rent_parking', name: 'Парковочное место', nameEn: 'Parking Spot', icon: '🅿️', requiresDiploma: false, isExpert: false, urgent: false, group: 'space', groupName: 'Пространства', groupNameEn: 'Spaces', groupIcon: '🏢' },
      { id: 'rent_garage', name: 'Гараж / Бокс', nameEn: 'Garage / Box', icon: '🚘', requiresDiploma: false, isExpert: false, urgent: false, group: 'space', groupName: 'Пространства', groupNameEn: 'Spaces', groupIcon: '🏢' },
      { id: 'rent_storage', name: 'Склад / Хранение', nameEn: 'Storage', icon: '📦', requiresDiploma: false, isExpert: false, urgent: false, group: 'space', groupName: 'Пространства', groupNameEn: 'Spaces', groupIcon: '🏢' },
      // ── Разное ──
      { id: 'rent_sport', name: 'Спортинвентарь', nameEn: 'Sports Equipment', icon: '⚽', requiresDiploma: false, isExpert: false, urgent: false, group: 'other', groupName: 'Разное', groupNameEn: 'Other', groupIcon: '🎯' },
      { id: 'rent_costume', name: 'Костюмы / Одежда', nameEn: 'Costumes / Clothing', icon: '👔', requiresDiploma: false, isExpert: false, urgent: false, group: 'other', groupName: 'Разное', groupNameEn: 'Other', groupIcon: '🎯' },
      { id: 'rent_party', name: 'Мероприятия / Декор', nameEn: 'Events / Decor', icon: '🎉', requiresDiploma: false, isExpert: false, urgent: false, group: 'other', groupName: 'Разное', groupNameEn: 'Other', groupIcon: '🎯' },
      { id: 'rent_kids', name: 'Детское оборудование', nameEn: 'Kids Equipment', icon: '👶', requiresDiploma: false, isExpert: false, urgent: false, group: 'other', groupName: 'Разное', groupNameEn: 'Other', groupIcon: '🎯' },
      { id: 'rent_medical', name: 'Медтехника', nameEn: 'Medical Equipment', icon: '🏥', requiresDiploma: false, isExpert: true, urgent: false, group: 'other', groupName: 'Разное', groupNameEn: 'Other', groupIcon: '🎯' },
      // ── Доставка аренды ──
      { id: 'rent_deliver', name: 'Доставка арендованного', nameEn: 'Rental Delivery', icon: '🚚', requiresDiploma: false, isExpert: false, urgent: true, group: 'delivery', groupName: 'Доставка', groupNameEn: 'Delivery', groupIcon: '🚚' },
      { id: 'rent_pickup', name: 'Самовывоз / Возврат', nameEn: 'Pickup / Return', icon: '📍', requiresDiploma: false, isExpert: false, urgent: false, group: 'delivery', groupName: 'Доставка', groupNameEn: 'Delivery', groupIcon: '🚚' },
      // ── Эксперт ──
      { id: 'rent_expert', name: 'Оценка / Страхование', nameEn: 'Appraisal / Insurance', icon: '🔍', requiresDiploma: false, isExpert: true, urgent: false, group: 'expert', groupName: 'Эксперт', groupNameEn: 'Expert', groupIcon: '🔍', proxyAvailable: true, proxyExamples: 'Оценить состояние арендуемого оборудования вместо вас', proxyExamplesEn: 'Assess rental equipment condition on your behalf' },
    ]
  },

  // ═══════════════════════════════════════
  // 11. ОНЛАЙН-КУРСЫ / ONLINE COURSES
  // ═══════════════════════════════════════
  {
    id: 'courses',
    name: 'Онлайн-курсы',
    nameEn: 'Online Courses',
    icon: '🎓',
    color: 'from-sky-500 to-blue-600',
    colorFrom: '#0ea5e9',
    colorTo: '#2563eb',
    accentBg: 'bg-sky-100',
    accentText: 'text-sky-700',
    description: 'IT, дизайн, бизнес, языки, маркетинг',
    descriptionEn: 'IT, design, business, languages, marketing',
    workerTitle: 'Преподаватель',
    workerTitleEn: 'Instructor',
    internshipAvailable: true,
    internExample: 'Стажёр-куратор: помощь студентам, проверка заданий',
    internExampleEn: 'Curator intern: student support, homework review',
    skills: [
      // ── Программирование / Programming ──
      { id: 'course_web', name: 'Веб-разработка', nameEn: 'Web Development', icon: '🌐', requiresDiploma: false, isExpert: false, urgent: false, group: 'programming', groupName: 'Программирование', groupNameEn: 'Programming', groupIcon: '💻', variants: [
        { id: 'course_web_html', name: 'HTML / CSS', nameEn: 'HTML / CSS', icon: '🎨' },
        { id: 'course_web_js', name: 'JavaScript', nameEn: 'JavaScript', icon: '⚡' },
        { id: 'course_web_react', name: 'React / Vue / Angular', nameEn: 'React / Vue / Angular', icon: '⚛️' },
        { id: 'course_web_node', name: 'Node.js / Backend', nameEn: 'Node.js / Backend', icon: '🟢' },
        { id: 'course_web_fullstack', name: 'Fullstack', nameEn: 'Fullstack', icon: '🔗' },
      ]},
      { id: 'course_mobile', name: 'Мобильная разработка', nameEn: 'Mobile Development', icon: '📱', requiresDiploma: false, isExpert: false, urgent: false, group: 'programming', groupName: 'Программирование', groupNameEn: 'Programming', groupIcon: '💻', variants: [
        { id: 'course_mobile_android', name: 'Android / Kotlin', nameEn: 'Android / Kotlin', icon: '🤖' },
        { id: 'course_mobile_ios', name: 'iOS / Swift', nameEn: 'iOS / Swift', icon: '🍎' },
        { id: 'course_mobile_flutter', name: 'Flutter / React Native', nameEn: 'Flutter / React Native', icon: '🦋' },
      ]},
      { id: 'course_python', name: 'Python', nameEn: 'Python', icon: '🐍', requiresDiploma: false, isExpert: false, urgent: false, group: 'programming', groupName: 'Программирование', groupNameEn: 'Programming', groupIcon: '💻', variants: [
        { id: 'course_python_basic', name: 'Основы Python', nameEn: 'Python Basics', icon: '📗' },
        { id: 'course_python_data', name: 'Data Science', nameEn: 'Data Science', icon: '📊' },
        { id: 'course_python_ml', name: 'Machine Learning', nameEn: 'Machine Learning', icon: '🤖' },
        { id: 'course_python_auto', name: 'Автоматизация', nameEn: 'Automation', icon: '⚙️' },
      ]},
      { id: 'course_devops', name: 'DevOps / Cloud', nameEn: 'DevOps / Cloud', icon: '☁️', requiresDiploma: false, isExpert: false, urgent: false, group: 'programming', groupName: 'Программирование', groupNameEn: 'Programming', groupIcon: '💻', variants: [
        { id: 'course_devops_docker', name: 'Docker / Kubernetes', nameEn: 'Docker / Kubernetes', icon: '🐳' },
        { id: 'course_devops_aws', name: 'AWS / GCP / Azure', nameEn: 'AWS / GCP / Azure', icon: '☁️' },
        { id: 'course_devops_cicd', name: 'CI/CD', nameEn: 'CI/CD', icon: '🔄' },
        { id: 'course_devops_linux', name: 'Linux / Серверы', nameEn: 'Linux / Servers', icon: '🐧' },
      ]},
      { id: 'course_blockchain', name: 'Блокчейн / Web3', nameEn: 'Blockchain / Web3', icon: '⛓️', requiresDiploma: false, isExpert: false, urgent: false, group: 'programming', groupName: 'Программирование', groupNameEn: 'Programming', groupIcon: '💻', variants: [
        { id: 'course_blockchain_solidity', name: 'Solidity / Smart Contracts', nameEn: 'Solidity / Smart Contracts', icon: '📜' },
        { id: 'course_blockchain_rust', name: 'Rust / Substrate', nameEn: 'Rust / Substrate', icon: '🦀' },
        { id: 'course_blockchain_defi', name: 'DeFi / NFT', nameEn: 'DeFi / NFT', icon: '💎' },
      ]},
      { id: 'course_cyber', name: 'Кибербезопасность', nameEn: 'Cybersecurity', icon: '🛡️', requiresDiploma: false, isExpert: false, urgent: false, group: 'programming', groupName: 'Программирование', groupNameEn: 'Programming', groupIcon: '💻' },
      { id: 'course_gamedev', name: 'Разработка игр', nameEn: 'Game Development', icon: '🎮', requiresDiploma: false, isExpert: false, urgent: false, group: 'programming', groupName: 'Программирование', groupNameEn: 'Programming', groupIcon: '💻', variants: [
        { id: 'course_gamedev_unity', name: 'Unity / C#', nameEn: 'Unity / C#', icon: '🎯' },
        { id: 'course_gamedev_unreal', name: 'Unreal Engine', nameEn: 'Unreal Engine', icon: '🔥' },
        { id: 'course_gamedev_2d', name: '2D / Pixel Art', nameEn: '2D / Pixel Art', icon: '🕹️' },
      ]},
      // ── Дизайн / Design ──
      { id: 'course_uiux', name: 'UI/UX Дизайн', nameEn: 'UI/UX Design', icon: '🎨', requiresDiploma: false, isExpert: false, urgent: false, group: 'design', groupName: 'Дизайн', groupNameEn: 'Design', groupIcon: '🎨', variants: [
        { id: 'course_uiux_figma', name: 'Figma', nameEn: 'Figma', icon: '🖌️' },
        { id: 'course_uiux_proto', name: 'Прототипирование', nameEn: 'Prototyping', icon: '📐' },
        { id: 'course_uiux_research', name: 'UX-исследования', nameEn: 'UX Research', icon: '🔍' },
      ]},
      { id: 'course_graphic', name: 'Графический дизайн', nameEn: 'Graphic Design', icon: '🖼️', requiresDiploma: false, isExpert: false, urgent: false, group: 'design', groupName: 'Дизайн', groupNameEn: 'Design', groupIcon: '🎨', variants: [
        { id: 'course_graphic_ps', name: 'Photoshop', nameEn: 'Photoshop', icon: '📸' },
        { id: 'course_graphic_ai', name: 'Illustrator', nameEn: 'Illustrator', icon: '✏️' },
        { id: 'course_graphic_brand', name: 'Брендинг / Лого', nameEn: 'Branding / Logo', icon: '💼' },
      ]},
      { id: 'course_3d', name: '3D и анимация', nameEn: '3D & Animation', icon: '🧊', requiresDiploma: false, isExpert: false, urgent: false, group: 'design', groupName: 'Дизайн', groupNameEn: 'Design', groupIcon: '🎨', variants: [
        { id: 'course_3d_blender', name: 'Blender', nameEn: 'Blender', icon: '🧊' },
        { id: 'course_3d_cinema', name: 'Cinema 4D / 3ds Max', nameEn: 'Cinema 4D / 3ds Max', icon: '🎬' },
        { id: 'course_3d_motion', name: 'Motion Design', nameEn: 'Motion Design', icon: '🎞️' },
      ]},
      { id: 'course_video', name: 'Видеомонтаж', nameEn: 'Video Editing', icon: '🎬', requiresDiploma: false, isExpert: false, urgent: false, group: 'design', groupName: 'Дизайн', groupNameEn: 'Design', groupIcon: '🎨', variants: [
        { id: 'course_video_premiere', name: 'Premiere Pro', nameEn: 'Premiere Pro', icon: '🎞️' },
        { id: 'course_video_after', name: 'After Effects', nameEn: 'After Effects', icon: '✨' },
        { id: 'course_video_davinci', name: 'DaVinci Resolve', nameEn: 'DaVinci Resolve', icon: '🎨' },
        { id: 'course_video_mobile', name: 'Монтаж на телефоне', nameEn: 'Mobile Editing', icon: '📱' },
      ]},
      // ── Маркетинг / Marketing ──
      { id: 'course_smm', name: 'SMM / Соцсети', nameEn: 'SMM / Social Media', icon: '📣', requiresDiploma: false, isExpert: false, urgent: false, group: 'marketing', groupName: 'Маркетинг', groupNameEn: 'Marketing', groupIcon: '📈', variants: [
        { id: 'course_smm_insta', name: 'Instagram / TikTok', nameEn: 'Instagram / TikTok', icon: '📷' },
        { id: 'course_smm_youtube', name: 'YouTube', nameEn: 'YouTube', icon: '▶️' },
        { id: 'course_smm_telegram', name: 'Telegram / VK', nameEn: 'Telegram / VK', icon: '✈️' },
        { id: 'course_smm_content', name: 'Контент-план', nameEn: 'Content Planning', icon: '📝' },
      ]},
      { id: 'course_seo', name: 'SEO / Контекст', nameEn: 'SEO / PPC', icon: '🔍', requiresDiploma: false, isExpert: false, urgent: false, group: 'marketing', groupName: 'Маркетинг', groupNameEn: 'Marketing', groupIcon: '📈', variants: [
        { id: 'course_seo_google', name: 'Google Ads', nameEn: 'Google Ads', icon: '🔎' },
        { id: 'course_seo_yandex', name: 'Яндекс.Директ', nameEn: 'Yandex.Direct', icon: '🟡' },
        { id: 'course_seo_organic', name: 'Органическое SEO', nameEn: 'Organic SEO', icon: '🌱' },
      ]},
      { id: 'course_copywrite', name: 'Копирайтинг', nameEn: 'Copywriting', icon: '✍️', requiresDiploma: false, isExpert: false, urgent: false, group: 'marketing', groupName: 'Маркетинг', groupNameEn: 'Marketing', groupIcon: '📈' },
      { id: 'course_target', name: 'Таргетированная реклама', nameEn: 'Targeted Ads', icon: '🎯', requiresDiploma: false, isExpert: false, urgent: false, group: 'marketing', groupName: 'Маркетинг', groupNameEn: 'Marketing', groupIcon: '📈' },
      { id: 'course_analytics', name: 'Аналитика и метрики', nameEn: 'Analytics & Metrics', icon: '📊', requiresDiploma: false, isExpert: false, urgent: false, group: 'marketing', groupName: 'Маркетинг', groupNameEn: 'Marketing', groupIcon: '📈' },
      // ── Бизнес / Business ──
      { id: 'course_startup', name: 'Стартап / Предпринимательство', nameEn: 'Startup / Entrepreneurship', icon: '🚀', requiresDiploma: false, isExpert: false, urgent: false, group: 'business', groupName: 'Бизнес', groupNameEn: 'Business', groupIcon: '💼' },
      { id: 'course_finance', name: 'Финансы и инвестиции', nameEn: 'Finance & Investing', icon: '💰', requiresDiploma: false, isExpert: false, urgent: false, group: 'business', groupName: 'Бизнес', groupNameEn: 'Business', groupIcon: '💼', variants: [
        { id: 'course_finance_invest', name: 'Инвестирование', nameEn: 'Investing', icon: '📈' },
        { id: 'course_finance_crypto', name: 'Криптовалюты', nameEn: 'Crypto', icon: '₿' },
        { id: 'course_finance_personal', name: 'Личные финансы', nameEn: 'Personal Finance', icon: '💳' },
        { id: 'course_finance_trading', name: 'Трейдинг', nameEn: 'Trading', icon: '📊' },
      ]},
      { id: 'course_management', name: 'Менеджмент / Управление', nameEn: 'Management', icon: '👔', requiresDiploma: false, isExpert: false, urgent: false, group: 'business', groupName: 'Бизнес', groupNameEn: 'Business', groupIcon: '💼' },
      { id: 'course_pm', name: 'Управление проектами', nameEn: 'Project Management', icon: '📋', requiresDiploma: false, isExpert: false, urgent: false, group: 'business', groupName: 'Бизнес', groupNameEn: 'Business', groupIcon: '💼', variants: [
        { id: 'course_pm_agile', name: 'Agile / Scrum', nameEn: 'Agile / Scrum', icon: '🔄' },
        { id: 'course_pm_jira', name: 'Jira / Trello', nameEn: 'Jira / Trello', icon: '📌' },
        { id: 'course_pm_product', name: 'Product Manager', nameEn: 'Product Manager', icon: '🎯' },
      ]},
      { id: 'course_sales', name: 'Продажи и переговоры', nameEn: 'Sales & Negotiation', icon: '🤝', requiresDiploma: false, isExpert: false, urgent: false, group: 'business', groupName: 'Бизнес', groupNameEn: 'Business', groupIcon: '💼' },
      // ── Языки / Languages ──
      { id: 'course_english', name: 'Английский язык', nameEn: 'English Language', icon: '🇬🇧', requiresDiploma: false, isExpert: false, urgent: false, group: 'languages', groupName: 'Языки', groupNameEn: 'Languages', groupIcon: '🌍', variants: [
        { id: 'course_english_beginner', name: 'С нуля (A1–A2)', nameEn: 'Beginner (A1–A2)', icon: '🌱' },
        { id: 'course_english_inter', name: 'Средний (B1–B2)', nameEn: 'Intermediate (B1–B2)', icon: '📗' },
        { id: 'course_english_advanced', name: 'Продвинутый (C1–C2)', nameEn: 'Advanced (C1–C2)', icon: '🎯' },
        { id: 'course_english_business', name: 'Business English', nameEn: 'Business English', icon: '💼' },
        { id: 'course_english_ielts', name: 'IELTS / TOEFL', nameEn: 'IELTS / TOEFL', icon: '📝' },
      ]},
      { id: 'course_chinese', name: 'Китайский язык', nameEn: 'Chinese Language', icon: '🇨🇳', requiresDiploma: false, isExpert: false, urgent: false, group: 'languages', groupName: 'Языки', groupNameEn: 'Languages', groupIcon: '🌍' },
      { id: 'course_korean', name: 'Корейский язык', nameEn: 'Korean Language', icon: '🇰🇷', requiresDiploma: false, isExpert: false, urgent: false, group: 'languages', groupName: 'Языки', groupNameEn: 'Languages', groupIcon: '🌍' },
      { id: 'course_german', name: 'Немецкий язык', nameEn: 'German Language', icon: '🇩🇪', requiresDiploma: false, isExpert: false, urgent: false, group: 'languages', groupName: 'Языки', groupNameEn: 'Languages', groupIcon: '🌍' },
      { id: 'course_turkish', name: 'Турецкий язык', nameEn: 'Turkish Language', icon: '🇹🇷', requiresDiploma: false, isExpert: false, urgent: false, group: 'languages', groupName: 'Языки', groupNameEn: 'Languages', groupIcon: '🌍' },
      { id: 'course_arabic', name: 'Арабский язык', nameEn: 'Arabic Language', icon: '🇸🇦', requiresDiploma: false, isExpert: false, urgent: false, group: 'languages', groupName: 'Языки', groupNameEn: 'Languages', groupIcon: '🌍' },
      // ── Саморазвитие / Self-development ──
      { id: 'course_ai_tools', name: 'AI инструменты', nameEn: 'AI Tools', icon: '🤖', requiresDiploma: false, isExpert: false, urgent: false, group: 'selfdev', groupName: 'Саморазвитие', groupNameEn: 'Self-development', groupIcon: '🧠', variants: [
        { id: 'course_ai_chatgpt', name: 'ChatGPT / Prompt Engineering', nameEn: 'ChatGPT / Prompt Engineering', icon: '💬' },
        { id: 'course_ai_midjourney', name: 'Midjourney / DALL-E', nameEn: 'Midjourney / DALL-E', icon: '🖼️' },
        { id: 'course_ai_automation', name: 'AI автоматизация', nameEn: 'AI Automation', icon: '⚡' },
      ]},
      { id: 'course_excel', name: 'Excel / Google Таблицы', nameEn: 'Excel / Google Sheets', icon: '📊', requiresDiploma: false, isExpert: false, urgent: false, group: 'selfdev', groupName: 'Саморазвитие', groupNameEn: 'Self-development', groupIcon: '🧠' },
      { id: 'course_nocode', name: 'No-Code / Low-Code', nameEn: 'No-Code / Low-Code', icon: '🧩', requiresDiploma: false, isExpert: false, urgent: false, group: 'selfdev', groupName: 'Саморазвитие', groupNameEn: 'Self-development', groupIcon: '🧠', variants: [
        { id: 'course_nocode_tilda', name: 'Tilda / Wix', nameEn: 'Tilda / Wix', icon: '🌐' },
        { id: 'course_nocode_notion', name: 'Notion / Airtable', nameEn: 'Notion / Airtable', icon: '📝' },
        { id: 'course_nocode_zapier', name: 'Zapier / Make', nameEn: 'Zapier / Make', icon: '🔗' },
      ]},
      { id: 'course_photo', name: 'Фотография', nameEn: 'Photography', icon: '📸', requiresDiploma: false, isExpert: false, urgent: false, group: 'selfdev', groupName: 'Саморазвитие', groupNameEn: 'Self-development', groupIcon: '🧠' },
      { id: 'course_public', name: 'Публичные выступления', nameEn: 'Public Speaking', icon: '🎤', requiresDiploma: false, isExpert: false, urgent: false, group: 'selfdev', groupName: 'Саморазвитие', groupNameEn: 'Self-development', groupIcon: '🧠' },
      // ── Эксперт / Expert ──
      { id: 'course_mentor', name: 'Менторство / Консультации', nameEn: 'Mentorship / Consulting', icon: '🔍', requiresDiploma: false, isExpert: true, urgent: false, group: 'expert', groupName: 'Эксперт', groupNameEn: 'Expert', groupIcon: '🔍', proxyAvailable: true, proxyExamples: 'Персональный ментор по карьере или обучению', proxyExamplesEn: 'Personal career or learning mentor' },
    ]
  },

];

// ═══════════════════════════════════════
// Helper functions
// ═══════════════════════════════════════
export const getDepartment = (id: string) => departments.find(d => d.id === id);
export const getDepartmentSkills = (deptId: string) => getDepartment(deptId)?.skills || [];
export const getSkill = (skillId: string) => {
  for (const dept of departments) {
    const skill = dept.skills.find(s => s.id === skillId);
    if (skill) return { ...skill, departmentId: dept.id };
  }
  return null;
};
export const getExpertSkills = (deptId: string) => getDepartmentSkills(deptId).filter(s => s.isExpert);
export const getUrgentSkills = (deptId: string) => getDepartmentSkills(deptId).filter(s => s.urgent);
export const getAllSkillCount = () => departments.reduce((acc, d) => acc + d.skills.length, 0);

// ═══════════════════════════════════════
// Skill Groups (3-level navigation)
// ═══════════════════════════════════════

export interface SkillGroup {
  key: string;
  name: string;
  nameEn: string;
  icon: string;
  skills: Skill[];
  skillCount: number;
}

/** Get unique groups for a department, preserving insertion order */
export const getSkillGroups = (deptId: string): SkillGroup[] => {
  const skills = getDepartmentSkills(deptId);
  const map = new Map<string, SkillGroup>();
  for (const s of skills) {
    const key = s.group || 'default';
    if (!map.has(key)) {
      map.set(key, {
        key,
        name: s.groupName || 'Услуги',
        nameEn: s.groupNameEn || 'Services',
        icon: s.groupIcon || '📋',
        skills: [],
        skillCount: 0,
      });
    }
    const g = map.get(key)!;
    g.skills.push(s);
    g.skillCount++;
  }
  return Array.from(map.values());
};

/** Get skills within a specific group */
export const getGroupSkills = (deptId: string, groupKey: string): Skill[] => {
  return getDepartmentSkills(deptId).filter(s => (s.group || 'default') === groupKey);
};

/** Get all proxy-available expert skills across all departments */
export const getProxySkills = (): { dept: Department; skill: Skill }[] => {
  const result: { dept: Department; skill: Skill }[] = [];
  for (const dept of departments) {
    for (const skill of dept.skills) {
      if (skill.proxyAvailable) {
        result.push({ dept, skill });
      }
    }
  }
  return result;
};

/** Get variants for a specific skill, returns empty array if none */
export const getSkillVariants = (deptId: string, skillId: string): SkillVariant[] => {
  const skill = getDepartmentSkills(deptId).find(s => s.id === skillId);
  return skill?.variants || [];
};

/** Check if any skill in a department has variants (4th level) */
export const deptHasVariants = (deptId: string): boolean => {
  return getDepartmentSkills(deptId).some(s => s.variants && s.variants.length > 0);
};
