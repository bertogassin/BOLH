// BOLH Multi-Profession Department System
// 9 departments, 50+ skills, expert services

export interface Skill {
  id: string;
  name: string;
  nameEn: string;
  icon: string; // emoji
  requiresDiploma: boolean;
  isExpert: boolean;
  urgent: boolean; // can be called urgently
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
    skills: [
      { id: 'plumb_general', name: 'Бытовой сантехник', nameEn: 'Household Plumber', icon: '🔧', requiresDiploma: false, isExpert: false, urgent: true },
      { id: 'plumb_clog', name: 'Засоры и канализация', nameEn: 'Clogs & Drainage', icon: '🚿', requiresDiploma: false, isExpert: false, urgent: true },
      { id: 'plumb_install', name: 'Монтаж сантехники', nameEn: 'Plumbing Installation', icon: '🚰', requiresDiploma: false, isExpert: false, urgent: false },
      { id: 'plumb_appliance', name: 'Подключение техники', nameEn: 'Appliance Connection', icon: '🧺', requiresDiploma: false, isExpert: false, urgent: false },
      { id: 'plumb_boiler', name: 'Водонагреватели', nameEn: 'Water Heaters', icon: '🔥', requiresDiploma: false, isExpert: false, urgent: true },
      { id: 'plumb_expert', name: 'Экспертиза сантехники', nameEn: 'Plumbing Expert Assessment', icon: '🔍', requiresDiploma: false, isExpert: true, urgent: false },
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
    skills: [
      { id: 'elec_general', name: 'Бытовой электрик', nameEn: 'Household Electrician', icon: '⚡', requiresDiploma: true, isExpert: false, urgent: true },
      { id: 'elec_ac', name: 'Кондиционеры и вентиляция', nameEn: 'AC & Ventilation', icon: '❄️', requiresDiploma: false, isExpert: false, urgent: true },
      { id: 'elec_wiring', name: 'Электропроводка', nameEn: 'Wiring', icon: '🔌', requiresDiploma: true, isExpert: false, urgent: false },
      { id: 'elec_lighting', name: 'Установка освещения', nameEn: 'Lighting Installation', icon: '💡', requiresDiploma: false, isExpert: false, urgent: false },
      { id: 'elec_expert', name: 'Проверка электробезопасности', nameEn: 'Electrical Safety Check', icon: '🔍', requiresDiploma: true, isExpert: true, urgent: false },
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
    skills: [
      { id: 'lock_open', name: 'Вскрытие замков', nameEn: 'Lock Opening', icon: '🔓', requiresDiploma: false, isExpert: false, urgent: true },
      { id: 'lock_install', name: 'Установка замков', nameEn: 'Lock Installation', icon: '🔐', requiresDiploma: false, isExpert: false, urgent: false },
      { id: 'lock_door', name: 'Ремонт дверей и петель', nameEn: 'Door & Hinge Repair', icon: '🚪', requiresDiploma: false, isExpert: false, urgent: false },
      { id: 'lock_furniture', name: 'Мебельная фурнитура', nameEn: 'Furniture Hardware', icon: '🪑', requiresDiploma: false, isExpert: false, urgent: false },
      { id: 'lock_expert', name: 'Оценка безопасности двери', nameEn: 'Door Security Assessment', icon: '🔍', requiresDiploma: false, isExpert: true, urgent: false },
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
    color: 'from-violet-500 to-purple-700',
    colorFrom: '#8b5cf6',
    colorTo: '#7e22ce',
    accentBg: 'bg-violet-100',
    accentText: 'text-violet-700',
    description: 'Бытовая техника, ПК, телефоны',
    descriptionEn: 'Appliances, PC, phones',
    workerTitle: 'Мастер',
    workerTitleEn: 'Technician',
    skills: [
      { id: 'tech_appliance', name: 'Бытовая техника', nameEn: 'Home Appliances', icon: '🧊', requiresDiploma: false, isExpert: false, urgent: true },
      { id: 'tech_small', name: 'Мелкая электроника', nameEn: 'Small Electronics', icon: '📻', requiresDiploma: false, isExpert: false, urgent: false },
      { id: 'tech_pc', name: 'Компьютеры и ноутбуки', nameEn: 'PC & Laptops', icon: '💻', requiresDiploma: false, isExpert: false, urgent: true },
      { id: 'tech_phone', name: 'Телефоны и планшеты', nameEn: 'Phones & Tablets', icon: '📱', requiresDiploma: false, isExpert: false, urgent: false },
      { id: 'tech_expert', name: 'Диагностика перед покупкой', nameEn: 'Pre-purchase Diagnosis', icon: '🔍', requiresDiploma: false, isExpert: true, urgent: false },
      { id: 'tech_remote', name: 'Удалённая помощь', nameEn: 'Remote Assistance', icon: '🌐', requiresDiploma: false, isExpert: true, urgent: true },
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
    skills: [
      { id: 'handy_general', name: 'Мелкий ремонт', nameEn: 'Small Repairs', icon: '🔨', requiresDiploma: false, isExpert: false, urgent: true },
      { id: 'handy_furniture', name: 'Сборка мебели', nameEn: 'Furniture Assembly', icon: '🪑', requiresDiploma: false, isExpert: false, urgent: false },
      { id: 'handy_mount', name: 'Навеска и монтаж', nameEn: 'Mounting & Hanging', icon: '📺', requiresDiploma: false, isExpert: false, urgent: false },
      { id: 'handy_paint', name: 'Покраска и отделка', nameEn: 'Painting & Finishing', icon: '🎨', requiresDiploma: false, isExpert: false, urgent: false },
      { id: 'handy_tile', name: 'Плитка и ламинат', nameEn: 'Tiles & Laminate', icon: '🧱', requiresDiploma: false, isExpert: false, urgent: false },
      { id: 'handy_expert', name: 'Оценка квартиры/ремонта', nameEn: 'Apartment/Renovation Assessment', icon: '🔍', requiresDiploma: false, isExpert: true, urgent: false },
      { id: 'handy_control', name: 'Контроль качества работ', nameEn: 'Quality Control', icon: '✅', requiresDiploma: false, isExpert: true, urgent: false },
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
    skills: [
      { id: 'clean_home', name: 'Уборка квартир/домов', nameEn: 'Home Cleaning', icon: '🏠', requiresDiploma: false, isExpert: false, urgent: true },
      { id: 'clean_office', name: 'Уборка офисов', nameEn: 'Office Cleaning', icon: '🏢', requiresDiploma: false, isExpert: false, urgent: false },
      { id: 'clean_deep', name: 'Генеральная уборка', nameEn: 'Deep Cleaning', icon: '✨', requiresDiploma: false, isExpert: false, urgent: false },
      { id: 'clean_window', name: 'Мойка окон', nameEn: 'Window Cleaning', icon: '🪟', requiresDiploma: false, isExpert: false, urgent: false },
      { id: 'clean_after', name: 'Уборка после ремонта', nameEn: 'Post-renovation Cleanup', icon: '🧹', requiresDiploma: false, isExpert: false, urgent: false },
      { id: 'clean_chem', name: 'Химчистка мебели/ковров', nameEn: 'Upholstery/Carpet Cleaning', icon: '🛋️', requiresDiploma: false, isExpert: false, urgent: false },
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
    description: 'Грузчики, перевозка, курьер',
    descriptionEn: 'Movers, transportation, courier',
    workerTitle: 'Грузчик',
    workerTitleEn: 'Mover',
    skills: [
      { id: 'move_loader', name: 'Грузчики', nameEn: 'Movers', icon: '📦', requiresDiploma: false, isExpert: false, urgent: true },
      { id: 'move_furniture', name: 'Перевозка мебели', nameEn: 'Furniture Moving', icon: '🛋️', requiresDiploma: false, isExpert: false, urgent: false },
      { id: 'move_courier', name: 'Курьер', nameEn: 'Courier', icon: '🏃', requiresDiploma: false, isExpert: false, urgent: true },
      { id: 'move_trash', name: 'Вывоз мусора', nameEn: 'Waste Removal', icon: '🗑️', requiresDiploma: false, isExpert: false, urgent: false },
      { id: 'move_pack', name: 'Упаковка вещей', nameEn: 'Packing', icon: '📋', requiresDiploma: false, isExpert: false, urgent: false },
      { id: 'move_expert', name: 'Планирование переезда', nameEn: 'Moving Planning', icon: '🔍', requiresDiploma: false, isExpert: true, urgent: false },
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
    color: 'from-indigo-500 to-purple-600',
    colorFrom: '#6366f1',
    colorTo: '#9333ea',
    accentBg: 'bg-indigo-100',
    accentText: 'text-indigo-700',
    description: 'Личная охрана, объекты, сопровождение',
    descriptionEn: 'Personal guard, facility, escort',
    workerTitle: 'Охранник',
    workerTitleEn: 'Guard',
    skills: [
      { id: 'sec_personal', name: 'Личная охрана', nameEn: 'Personal Guard', icon: '🛡️', requiresDiploma: true, isExpert: false, urgent: true },
      { id: 'sec_facility', name: 'Охрана объектов', nameEn: 'Facility Security', icon: '🏢', requiresDiploma: true, isExpert: false, urgent: false },
      { id: 'sec_escort', name: 'Сопровождение', nameEn: 'Escort Service', icon: '🚶', requiresDiploma: false, isExpert: false, urgent: true },
      { id: 'sec_urgent', name: 'Срочный выезд', nameEn: 'Emergency Dispatch', icon: '🚨', requiresDiploma: false, isExpert: false, urgent: true },
      { id: 'sec_expert', name: 'Оценка безопасности объекта', nameEn: 'Security Assessment', icon: '🔍', requiresDiploma: true, isExpert: true, urgent: false },
      { id: 'sec_consult', name: 'Консультация по защите', nameEn: 'Protection Consulting', icon: '📋', requiresDiploma: false, isExpert: true, urgent: false },
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
    skills: [
      { id: 'auto_garage', name: 'Механик с гаражом', nameEn: 'Garage Mechanic', icon: '🏗️', requiresDiploma: false, isExpert: false, urgent: false },
      { id: 'auto_mobile', name: 'Механик на выезд', nameEn: 'Mobile Mechanic', icon: '🔧', requiresDiploma: false, isExpert: false, urgent: true },
      { id: 'auto_tow', name: 'Буксир / Эвакуатор', nameEn: 'Towing / Recovery', icon: '🚛', requiresDiploma: false, isExpert: false, urgent: true },
      { id: 'auto_tire', name: 'Шиномонтаж', nameEn: 'Tire Service', icon: '🛞', requiresDiploma: false, isExpert: false, urgent: true },
      { id: 'auto_wash', name: 'Мойка авто', nameEn: 'Car Wash', icon: '🧽', requiresDiploma: false, isExpert: false, urgent: false },
      { id: 'auto_electric', name: 'Автоэлектрик', nameEn: 'Auto Electrician', icon: '⚡', requiresDiploma: false, isExpert: false, urgent: true },
      { id: 'auto_expert', name: 'Проверка авто перед покупкой', nameEn: 'Pre-purchase Car Inspection', icon: '🔍', requiresDiploma: false, isExpert: true, urgent: false },
      { id: 'auto_diag', name: 'Диагностика', nameEn: 'Diagnostics', icon: '📊', requiresDiploma: false, isExpert: true, urgent: false },
    ]
  },
];

// Helper functions
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
