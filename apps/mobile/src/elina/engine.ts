/**
 * Elina AI Engine — Hybrid Architecture
 * 
 * Гибридная архитектура: локальный ИИ + готовность к серверу
 * 
 * Уровни:
 *   1. Local Rules   — быстрые паттерны, всегда работает оффлайн
 *   2. Context Engine — понимает контекст пользователя (экран, время, история)
 *   3. Memory         — запоминает предпочтения и диалоги
 *   4. Remote AI      — подключение к серверу (когда будет готов)
 */

// ============== Types ==============

export interface ElinaMessage {
  id: number;
  from: 'user' | 'elina';
  text: string;
  time: string;
  emotion?: ElinaEmotion;
  action?: ElinaAction;
}

export type ElinaEmotion = 'neutral' | 'happy' | 'thinking' | 'excited' | 'confused' | 'proud';

export interface ElinaAction {
  type: 'navigate' | 'highlight' | 'suggest' | 'celebrate';
  target?: string;
  data?: any;
}

export interface ElinaContext {
  currentPage: string;
  userMode: 'client' | 'worker';
  language: 'ru' | 'en';
  timeOfDay: 'morning' | 'afternoon' | 'evening' | 'night';
  walletBalance?: number;
  skillCount?: number;
  referralCount?: number;
  messageHistory: ElinaMessage[];
  userPreferences: Record<string, any>;
}

export interface ElinaProvider {
  name: string;
  priority: number;
  canHandle: (input: string, ctx: ElinaContext) => boolean;
  respond: (input: string, ctx: ElinaContext) => Promise<ElinaResponse>;
}

export interface ElinaResponse {
  text: string;
  emotion: ElinaEmotion;
  action?: ElinaAction;
  confidence: number;
  source: string;
}

// ============== Helpers ==============

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ============== Memory ==============

class ElinaMemory {
  private store: Record<string, any> = {};
  private conversations: { input: string; response: string; timestamp: number }[] = [];

  constructor() {
    this.load();
  }

  private load() {
    try {
      const raw = localStorage.getItem('elina_memory');
      if (raw) {
        const data = JSON.parse(raw);
        this.store = data.store || {};
        this.conversations = data.conversations || [];
      }
    } catch (_) { /* no localStorage */ }
  }

  save() {
    try {
      if (this.conversations.length > 200) {
        this.conversations = this.conversations.slice(-200);
      }
      localStorage.setItem('elina_memory', JSON.stringify({
        store: this.store,
        conversations: this.conversations,
      }));
    } catch (_) { /* no localStorage */ }
  }

  remember(key: string, value: any) { this.store[key] = value; this.save(); }
  recall(key: string): any { return this.store[key]; }

  addConversation(input: string, response: string) {
    this.conversations.push({ input, response, timestamp: Date.now() });
    this.save();
  }

  getRecentTopics(n = 5): string[] {
    return this.conversations.slice(-n).map(c => c.input);
  }

  getConversationCount(): number { return this.conversations.length; }
  getUserName(): string | null { return this.store['userName'] || null; }
  setUserName(name: string) { this.remember('userName', name); }
}

// ============== Local Rules Provider ==============

const localRulesProvider: ElinaProvider = {
  name: 'local-rules',
  priority: 1,
  canHandle: () => true,
  respond: async (input: string, ctx: ElinaContext): Promise<ElinaResponse> => {
    const lower = input.toLowerCase();
    const isEn = ctx.language === 'en';

    if (/привет|здравствуй|салам|hi|hello|hey|yo/.test(lower)) {
      const g = isEn
        ? ['Hey there! I\'m Elina, your BOLH assistant. What\'s up?', 'Hi! Ready to help with anything in BOLH!', 'Hello! Tap me anytime 😊']
        : ['Привет! Я Элина, помощник BOLH. Чем помочь?', 'Здравствуй! Готова помочь с чем угодно!', 'Привет! Нажми на меня когда нужна помощь 😊'];
      return { text: pick(g), emotion: 'happy', confidence: 0.95, source: 'local-rules' };
    }

    if (/меня зовут|my name is/i.test(lower)) {
      const match = input.match(/(?:меня зовут|my name is)\s+(\S+)/i);
      if (match) {
        return {
          text: isEn ? `Nice to meet you, ${match[1]}! I'll remember that.` : `Приятно познакомиться, ${match[1]}! Запомню.`,
          emotion: 'happy', action: { type: 'suggest', data: { setName: match[1] } }, confidence: 0.9, source: 'local-rules',
        };
      }
    }

    if (/кошел[её]к|wallet|монет|coin|grd|баланс|balance|деньги|money/.test(lower)) {
      return {
        text: isEn ? 'Your BOLH wallet stores GRD coins on the blockchain. Check the Wallet tab! Earn through work and referrals.' : 'Кошелёк BOLH хранит монеты GRD на блокчейне. Зайди в "Кошелёк"! Заработать можно через работу и рефералов.',
        emotion: 'neutral', action: { type: 'navigate', target: 'wallet' }, confidence: 0.9, source: 'local-rules',
      };
    }

    if (/реферал|invite|пригласи|referral|друз|friend/.test(lower)) {
      return {
        text: isEn ? 'Invite friends with your referral link and earn bonus GRD! Find the link in the Wallet section.' : 'Приглашай друзей по реферальной ссылке и получай бонусные GRD! Ссылка в разделе "Кошелёк".',
        emotion: 'excited', action: { type: 'navigate', target: 'wallet' }, confidence: 0.9, source: 'local-rules',
      };
    }

    if (/блокчейн|blockchain|chain|p2p|сет[ьи]|network|контракт|contract|узел|node/.test(lower)) {
      return {
        text: isEn ? 'BOLH blockchain is our decentralized network. P2P nodes, smart contracts, all transactions secured. Check Chain tab in Wallet!' : 'Блокчейн BOLH — собственная децентрализованная сеть. P2P узлы, смарт-контракты, всё защищено. Смотри вкладку "Цепочка"!',
        emotion: 'proud', confidence: 0.9, source: 'local-rules',
      };
    }

    if (/работ[аы]|профес|навык|skill|job|work|заказ|order|услуг|service|зарабо|earn/.test(lower)) {
      return {
        text: isEn ? 'Choose a profession on the home screen, pick skills, and clients will find you! Switch client/worker mode in profile.' : 'Выбери профессию на главном экране, отметь навыки — клиенты тебя найдут! Переключай режим в профиле.',
        emotion: 'neutral', action: { type: 'navigate', target: 'home' }, confidence: 0.9, source: 'local-rules',
      };
    }

    if (/профил[ьия]|profile|настро|setting|режим|mode/.test(lower)) {
      return {
        text: isEn ? 'In profile: manage skills, switch client/worker mode, set language, view rating.' : 'В профиле: навыки, переключение режима, язык, рейтинг.',
        emotion: 'neutral', action: { type: 'navigate', target: 'profile' }, confidence: 0.85, source: 'local-rules',
      };
    }

    if (/карт[аеу]|map|рядом|near|локац|location|где|where/.test(lower)) {
      return {
        text: isEn ? 'The map shows specialists near you in real time. Open the Map tab!' : 'Карта показывает специалистов рядом. Открой вкладку "Карта"!',
        emotion: 'neutral', action: { type: 'navigate', target: 'map' }, confidence: 0.85, source: 'local-rules',
      };
    }

    if (/кто ты|who are you|элина|elina|что ты|what are you|расскажи о себе/.test(lower)) {
      return {
        text: isEn ? 'I\'m Elina — the BOLH AI assistant! I live in this octagon 😄 I help navigate the app and explain features. Growing every day!' : 'Я Элина — ИИ-помощник BOLH! Живу в восьмиугольнике 😄 Помогаю разобраться в приложении. Расту каждый день!',
        emotion: 'happy', confidence: 0.95, source: 'local-rules',
      };
    }

    if (/помо[щг]|help|что умеешь|can you|возможности|features/.test(lower)) {
      return {
        text: isEn ? 'I can help with:\n• 💼 Work & professions\n• 💰 Wallet & blockchain\n• 👥 Referral program\n• 🗺 Map\n• 👤 Profile\n• 🔗 Smart contracts\nJust ask!' : 'Могу помочь:\n• 💼 Работа и профессии\n• 💰 Кошелёк и блокчейн\n• 👥 Рефералы\n• 🗺 Карта\n• 👤 Профиль\n• 🔗 Смарт-контракты\nПросто спроси!',
        emotion: 'happy', confidence: 0.95, source: 'local-rules',
      };
    }

    if (/спасибо|thanks|thank|молодец|класс|cool|круто|awesome/.test(lower)) {
      const r = isEn ? ['You\'re welcome! 😊', 'Happy to help!', 'Anytime!'] : ['Пожалуйста! 😊', 'Рада помочь!', 'Обращайся!'];
      return { text: pick(r), emotion: 'happy', confidence: 0.9, source: 'local-rules' };
    }

    if (/шутк|joke|смешн|funny|рассмеш/.test(lower)) {
      const j = isEn
        ? ['Why do programmers prefer dark mode? Light attracts bugs! 🐛', 'Told my blockchain a joke... took 6 confirmations to laugh.']
        : ['Почему программисты любят тёмную тему? Свет привлекает баги! 🐛', 'Рассказала блокчейну шутку — потребовалось 6 подтверждений.'];
      return { text: pick(j), emotion: 'happy', confidence: 0.8, source: 'local-rules' };
    }

    const d = isEn
      ? ['Interesting question! Try asking about wallet, work, or blockchain!', 'Hmm, type "help" to see what I can do!', 'I\'m still growing — ask about BOLH features!']
      : ['Интересный вопрос! Спроси про кошелёк, работу или блокчейн!', 'Хм, напиши "помощь" — покажу что умею!', 'Ещё расту — спроси про функции BOLH!'];
    return { text: pick(d), emotion: 'confused', confidence: 0.3, source: 'local-rules' };
  },
};

// ============== Context Provider ==============

const contextProvider: ElinaProvider = {
  name: 'context-aware',
  priority: 2,
  canHandle: (_input: string, ctx: ElinaContext) => ctx.currentPage !== 'home' || ctx.messageHistory.length > 3,
  respond: async (input: string, ctx: ElinaContext): Promise<ElinaResponse> => {
    const isEn = ctx.language === 'en';
    const lower = input.toLowerCase();

    if (/привет|hi|hello/.test(lower)) {
      const tg: Record<string, string> = {
        morning: isEn ? 'Good morning! ☀️' : 'Доброе утро! ☀️',
        afternoon: isEn ? 'Good afternoon! 🌤' : 'Добрый день! 🌤',
        evening: isEn ? 'Good evening! 🌙' : 'Добрый вечер! 🌙',
        night: isEn ? 'Working late? 🦉' : 'Не спишь? 🦉',
      };
      return { text: tg[ctx.timeOfDay] + (isEn ? ' How can I help?' : ' Чем помочь?'), emotion: 'happy', confidence: 0.85, source: 'context-aware' };
    }

    if (ctx.currentPage === 'wallet' && /что|what|как|how/.test(lower)) {
      return {
        text: isEn ? 'You\'re in the Wallet! Check GRD balance, blockchain, P2P network, and block explorer here.' : 'Ты в кошельке! Здесь баланс GRD, блокчейн, P2P сеть и обозреватель блоков.',
        emotion: 'neutral', confidence: 0.8, source: 'context-aware',
      };
    }

    return { text: '', emotion: 'neutral', confidence: 0, source: 'context-aware' };
  },
};

// ============== Remote AI Provider (Future) ==============

const remoteAIProvider: ElinaProvider = {
  name: 'remote-ai',
  priority: 3,
  canHandle: () => false, // Enable when server is ready
  respond: async (_input: string, _ctx: ElinaContext): Promise<ElinaResponse> => {
    // Future: POST to https://api.bolh.app/elina/chat
    return { text: '', emotion: 'neutral', confidence: 0, source: 'remote-ai' };
  },
};

// ============== Engine ==============

export class ElinaEngine {
  private providers: ElinaProvider[];
  private memory: ElinaMemory;
  private context: ElinaContext;
  private msgId = 0;

  constructor() {
    this.memory = new ElinaMemory();
    this.context = {
      currentPage: 'home', userMode: 'client', language: 'ru',
      timeOfDay: this.getTimeOfDay(), messageHistory: [], userPreferences: {},
    };
    this.providers = [remoteAIProvider, contextProvider, localRulesProvider].sort((a, b) => b.priority - a.priority);
  }

  private getTimeOfDay(): 'morning' | 'afternoon' | 'evening' | 'night' {
    const h = new Date().getHours();
    if (h < 6) return 'night'; if (h < 12) return 'morning'; if (h < 18) return 'afternoon'; return 'evening';
  }

  updateContext(partial: Partial<ElinaContext>) {
    Object.assign(this.context, partial);
    this.context.timeOfDay = this.getTimeOfDay();
  }

  async processMessage(input: string): Promise<ElinaResponse> {
    this.context.timeOfDay = this.getTimeOfDay();

    const nameMatch = input.match(/(?:меня зовут|my name is)\s+(\S+)/i);
    if (nameMatch) this.memory.setUserName(nameMatch[1]);

    let best: ElinaResponse | null = null;
    for (const p of this.providers) {
      if (p.canHandle(input, this.context)) {
        try {
          const r = await p.respond(input, this.context);
          if (r.confidence > (best?.confidence || 0)) best = r;
          if (r.confidence >= 0.8) break;
        } catch (_) { /* next */ }
      }
    }

    const final = best || {
      text: this.context.language === 'en' ? 'Hmm, let me think...' : 'Хм, дай подумать...',
      emotion: 'confused' as ElinaEmotion, confidence: 0.1, source: 'fallback',
    };

    this.memory.addConversation(input, final.text);
    this.context.messageHistory.push(
      { id: ++this.msgId, from: 'user', text: input, time: this.now() },
      { id: ++this.msgId, from: 'elina', text: final.text, time: this.now(), emotion: final.emotion, action: final.action },
    );

    return final;
  }

  getGreeting(): string {
    const isEn = this.context.language === 'en';
    const name = this.memory.getUserName();
    const count = this.memory.getConversationCount();

    if (count === 0) return isEn ? 'Hey! I\'m Elina, your BOLH assistant. Nice to meet you! 😊' : 'Привет! Я Элина, помощник BOLH. Приятно познакомиться! 😊';
    if (name) return pick(isEn ? [`Welcome back, ${name}!`, `Hey ${name}!`] : [`С возвращением, ${name}!`, `Привет, ${name}!`]);
    return pick(isEn ? ['Welcome back!', 'Hey again!'] : ['С возвращением!', 'Привет снова!']);
  }

  getMemory() { return this.memory; }

  registerProvider(provider: ElinaProvider) {
    this.providers.push(provider);
    this.providers.sort((a, b) => b.priority - a.priority);
  }

  private now(): string {
    const d = new Date();
    return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
  }
}

// Singleton
let _engine: ElinaEngine | null = null;
export function getElinaEngine(): ElinaEngine {
  if (!_engine) _engine = new ElinaEngine();
  return _engine;
}
