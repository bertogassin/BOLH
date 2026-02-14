// BOLH Daily English — Learn English with the World
// A daily word, phrase, or grammar rule shown on the home screen.
// Explanations adapt to user's language via i18n keys.

export interface DailyLesson {
  id: number;
  type: 'word' | 'phrase' | 'grammar';
  /** The English word or phrase */
  english: string;
  /** Pronunciation hint (simplified) */
  pronunciation: string;
  /** Example sentence in English */
  example: string;
  /** i18n key for the translation/explanation (localized to user's language) */
  translationKey: string;
  /** i18n key for the example translation */
  exampleKey: string;
  /** i18n key for a tip/grammar note */
  tipKey: string;
  /** Category emoji */
  emoji: string;
  /** Difficulty: 1=beginner, 2=intermediate, 3=advanced */
  level: 1 | 2 | 3;
}

// 365 lessons — one for every day of the year
// Cycle: Mon-Fri words/phrases, Sat grammar rule, Sun phrase of the week
export const lessons: DailyLesson[] = [
  // ── Week 1: Greetings ──
  { id: 1, type: 'word', english: 'Hello', pronunciation: 'heh-LOH', example: 'Hello, how are you?', translationKey: 'elearn.1.tr', exampleKey: 'elearn.1.ex', tipKey: 'elearn.1.tip', emoji: '👋', level: 1 },
  { id: 2, type: 'word', english: 'Thank you', pronunciation: 'THAENK yoo', example: 'Thank you for your help!', translationKey: 'elearn.2.tr', exampleKey: 'elearn.2.ex', tipKey: 'elearn.2.tip', emoji: '🙏', level: 1 },
  { id: 3, type: 'word', english: 'Please', pronunciation: 'pleez', example: 'Please wait a moment.', translationKey: 'elearn.3.tr', exampleKey: 'elearn.3.ex', tipKey: 'elearn.3.tip', emoji: '🤝', level: 1 },
  { id: 4, type: 'word', english: 'Sorry', pronunciation: 'SAH-ree', example: 'Sorry, I\'m late.', translationKey: 'elearn.4.tr', exampleKey: 'elearn.4.ex', tipKey: 'elearn.4.tip', emoji: '😔', level: 1 },
  { id: 5, type: 'phrase', english: 'Nice to meet you', pronunciation: 'nais tuh meet yoo', example: 'Hi, I\'m Alex. Nice to meet you!', translationKey: 'elearn.5.tr', exampleKey: 'elearn.5.ex', tipKey: 'elearn.5.tip', emoji: '🤗', level: 1 },
  { id: 6, type: 'grammar', english: 'I am / You are / He is', pronunciation: 'ai em / yoo ar / hee iz', example: 'I am a worker. You are the client. He is the expert.', translationKey: 'elearn.6.tr', exampleKey: 'elearn.6.ex', tipKey: 'elearn.6.tip', emoji: '📖', level: 1 },
  { id: 7, type: 'phrase', english: 'Have a great day!', pronunciation: 'haev uh grayt day', example: 'See you later! Have a great day!', translationKey: 'elearn.7.tr', exampleKey: 'elearn.7.ex', tipKey: 'elearn.7.tip', emoji: '☀️', level: 1 },

  // ── Week 2: Work & Services ──
  { id: 8, type: 'word', english: 'Job', pronunciation: 'jahb', example: 'I found a great job.', translationKey: 'elearn.8.tr', exampleKey: 'elearn.8.ex', tipKey: 'elearn.8.tip', emoji: '💼', level: 1 },
  { id: 9, type: 'word', english: 'Service', pronunciation: 'SUR-vis', example: 'This service is excellent!', translationKey: 'elearn.9.tr', exampleKey: 'elearn.9.ex', tipKey: 'elearn.9.tip', emoji: '⭐', level: 1 },
  { id: 10, type: 'word', english: 'Price', pronunciation: 'prais', example: 'What is the price?', translationKey: 'elearn.10.tr', exampleKey: 'elearn.10.ex', tipKey: 'elearn.10.tip', emoji: '💰', level: 1 },
  { id: 11, type: 'word', english: 'Order', pronunciation: 'OR-dur', example: 'I want to place an order.', translationKey: 'elearn.11.tr', exampleKey: 'elearn.11.ex', tipKey: 'elearn.11.tip', emoji: '📦', level: 1 },
  { id: 12, type: 'phrase', english: 'How much does it cost?', pronunciation: 'hau much daz it kost', example: 'How much does it cost to fix the pipe?', translationKey: 'elearn.12.tr', exampleKey: 'elearn.12.ex', tipKey: 'elearn.12.tip', emoji: '🤔', level: 1 },
  { id: 13, type: 'grammar', english: 'Do / Does — questions', pronunciation: 'doo / daz', example: 'Do you work here? Does he deliver?', translationKey: 'elearn.13.tr', exampleKey: 'elearn.13.ex', tipKey: 'elearn.13.tip', emoji: '📖', level: 1 },
  { id: 14, type: 'phrase', english: 'I need help with...', pronunciation: 'ai need help with', example: 'I need help with my car.', translationKey: 'elearn.14.tr', exampleKey: 'elearn.14.ex', tipKey: 'elearn.14.tip', emoji: '🔧', level: 1 },

  // ── Week 3: Numbers & Time ──
  { id: 15, type: 'word', english: 'One, Two, Three', pronunciation: 'wun, too, three', example: 'I need three hours.', translationKey: 'elearn.15.tr', exampleKey: 'elearn.15.ex', tipKey: 'elearn.15.tip', emoji: '🔢', level: 1 },
  { id: 16, type: 'word', english: 'Today / Tomorrow', pronunciation: 'tuh-DAY / tuh-MAH-roh', example: 'Can you come today or tomorrow?', translationKey: 'elearn.16.tr', exampleKey: 'elearn.16.ex', tipKey: 'elearn.16.tip', emoji: '📅', level: 1 },
  { id: 17, type: 'word', english: 'Hour / Minute', pronunciation: 'ow-ur / MIN-it', example: 'Wait 30 minutes please.', translationKey: 'elearn.17.tr', exampleKey: 'elearn.17.ex', tipKey: 'elearn.17.tip', emoji: '⏰', level: 1 },
  { id: 18, type: 'word', english: 'Money', pronunciation: 'MUH-nee', example: 'The money is in the wallet.', translationKey: 'elearn.18.tr', exampleKey: 'elearn.18.ex', tipKey: 'elearn.18.tip', emoji: '💵', level: 1 },
  { id: 19, type: 'phrase', english: 'What time is it?', pronunciation: 'wut taim iz it', example: 'Excuse me, what time is it?', translationKey: 'elearn.19.tr', exampleKey: 'elearn.19.ex', tipKey: 'elearn.19.tip', emoji: '🕐', level: 1 },
  { id: 20, type: 'grammar', english: 'There is / There are', pronunciation: 'ther iz / ther ar', example: 'There is a problem. There are two options.', translationKey: 'elearn.20.tr', exampleKey: 'elearn.20.ex', tipKey: 'elearn.20.tip', emoji: '📖', level: 1 },
  { id: 21, type: 'phrase', english: 'I\'ll be there in 10 minutes', pronunciation: 'ail bee ther in ten MIN-its', example: 'Don\'t worry, I\'ll be there in 10 minutes.', translationKey: 'elearn.21.tr', exampleKey: 'elearn.21.ex', tipKey: 'elearn.21.tip', emoji: '🏃', level: 1 },

  // ── Week 4: Home & Repair ──
  { id: 22, type: 'word', english: 'Fix / Repair', pronunciation: 'fiks / rih-PAIR', example: 'Can you fix this?', translationKey: 'elearn.22.tr', exampleKey: 'elearn.22.ex', tipKey: 'elearn.22.tip', emoji: '🔧', level: 1 },
  { id: 23, type: 'word', english: 'Broken', pronunciation: 'BROH-ken', example: 'The pipe is broken.', translationKey: 'elearn.23.tr', exampleKey: 'elearn.23.ex', tipKey: 'elearn.23.tip', emoji: '💔', level: 1 },
  { id: 24, type: 'word', english: 'Safe / Safety', pronunciation: 'sayf / SAYF-tee', example: 'Your safety is our priority.', translationKey: 'elearn.24.tr', exampleKey: 'elearn.24.ex', tipKey: 'elearn.24.tip', emoji: '🛡️', level: 1 },
  { id: 25, type: 'word', english: 'Delivery', pronunciation: 'dih-LIV-uh-ree', example: 'The delivery will arrive soon.', translationKey: 'elearn.25.tr', exampleKey: 'elearn.25.ex', tipKey: 'elearn.25.tip', emoji: '🚚', level: 1 },
  { id: 26, type: 'phrase', english: 'Is everything okay?', pronunciation: 'iz EV-ree-thing oh-KAY', example: 'The work is done. Is everything okay?', translationKey: 'elearn.26.tr', exampleKey: 'elearn.26.ex', tipKey: 'elearn.26.tip', emoji: '✅', level: 1 },
  { id: 27, type: 'grammar', english: 'Can / Can\'t', pronunciation: 'kaen / kaent', example: 'I can fix it. I can\'t come today.', translationKey: 'elearn.27.tr', exampleKey: 'elearn.27.ex', tipKey: 'elearn.27.tip', emoji: '📖', level: 1 },
  { id: 28, type: 'phrase', english: 'Let me take a look', pronunciation: 'let mee tayk uh luk', example: 'Let me take a look at the problem.', translationKey: 'elearn.28.tr', exampleKey: 'elearn.28.ex', tipKey: 'elearn.28.tip', emoji: '🔍', level: 1 },

  // ── Week 5: Communication ──
  { id: 29, type: 'word', english: 'Call / Message', pronunciation: 'kol / MEH-sij', example: 'I will call you back.', translationKey: 'elearn.29.tr', exampleKey: 'elearn.29.ex', tipKey: 'elearn.29.tip', emoji: '📞', level: 1 },
  { id: 30, type: 'word', english: 'Address', pronunciation: 'AD-res', example: 'What is your address?', translationKey: 'elearn.30.tr', exampleKey: 'elearn.30.ex', tipKey: 'elearn.30.tip', emoji: '📍', level: 1 },
  { id: 31, type: 'word', english: 'Ready', pronunciation: 'REH-dee', example: 'I\'m ready to start.', translationKey: 'elearn.31.tr', exampleKey: 'elearn.31.ex', tipKey: 'elearn.31.tip', emoji: '✅', level: 1 },
  { id: 32, type: 'word', english: 'Wait', pronunciation: 'wayt', example: 'Please wait a moment.', translationKey: 'elearn.32.tr', exampleKey: 'elearn.32.ex', tipKey: 'elearn.32.tip', emoji: '⏳', level: 1 },
  { id: 33, type: 'phrase', english: 'Could you send me a photo?', pronunciation: 'kud yoo send mee uh FOH-toh', example: 'Could you send me a photo of the problem?', translationKey: 'elearn.33.tr', exampleKey: 'elearn.33.ex', tipKey: 'elearn.33.tip', emoji: '📸', level: 1 },
  { id: 34, type: 'grammar', english: 'Will / Won\'t — future', pronunciation: 'wil / wohnt', example: 'I will finish today. It won\'t take long.', translationKey: 'elearn.34.tr', exampleKey: 'elearn.34.ex', tipKey: 'elearn.34.tip', emoji: '📖', level: 1 },
  { id: 35, type: 'phrase', english: 'I\'m on my way', pronunciation: 'aim on mai way', example: 'I\'m on my way to your location.', translationKey: 'elearn.35.tr', exampleKey: 'elearn.35.ex', tipKey: 'elearn.35.tip', emoji: '🚗', level: 1 },

  // ── Week 6: Business ──
  { id: 36, type: 'word', english: 'Payment', pronunciation: 'PAY-ment', example: 'Payment confirmed.', translationKey: 'elearn.36.tr', exampleKey: 'elearn.36.ex', tipKey: 'elearn.36.tip', emoji: '💳', level: 2 },
  { id: 37, type: 'word', english: 'Review / Rating', pronunciation: 'rih-VYOO / RAY-ting', example: 'Please leave a review.', translationKey: 'elearn.37.tr', exampleKey: 'elearn.37.ex', tipKey: 'elearn.37.tip', emoji: '⭐', level: 2 },
  { id: 38, type: 'word', english: 'Schedule', pronunciation: 'SKEH-jool', example: 'Let me check my schedule.', translationKey: 'elearn.38.tr', exampleKey: 'elearn.38.ex', tipKey: 'elearn.38.tip', emoji: '📋', level: 2 },
  { id: 39, type: 'word', english: 'Experience', pronunciation: 'ik-SPEER-ee-ens', example: 'I have 5 years of experience.', translationKey: 'elearn.39.tr', exampleKey: 'elearn.39.ex', tipKey: 'elearn.39.tip', emoji: '🏆', level: 2 },
  { id: 40, type: 'phrase', english: 'I\'d like to hire you', pronunciation: 'aid laik tuh HIRE yoo', example: 'Great profile! I\'d like to hire you.', translationKey: 'elearn.40.tr', exampleKey: 'elearn.40.ex', tipKey: 'elearn.40.tip', emoji: '🤝', level: 2 },
  { id: 41, type: 'grammar', english: 'Have / Has — present perfect', pronunciation: 'haev / haez', example: 'I have finished. She has arrived.', translationKey: 'elearn.41.tr', exampleKey: 'elearn.41.ex', tipKey: 'elearn.41.tip', emoji: '📖', level: 2 },
  { id: 42, type: 'phrase', english: 'The job is done!', pronunciation: 'thuh jahb iz dun', example: 'Everything is clean. The job is done!', translationKey: 'elearn.42.tr', exampleKey: 'elearn.42.ex', tipKey: 'elearn.42.tip', emoji: '🎉', level: 1 },

  // ── Weeks 7-52 placeholder pattern (filled progressively) ──
  // Topics: Transport, Food, Weather, Emotions, Technology, Travel,
  // Health, Legal terms, Negotiations, Contracts, Small talk, etc.
  // Total: 365 lessons for a full year cycle

  // Week 7: Transport & Directions
  { id: 43, type: 'word', english: 'Left / Right / Straight', pronunciation: 'left / rait / strayt', example: 'Turn left, then go straight.', translationKey: 'elearn.43.tr', exampleKey: 'elearn.43.ex', tipKey: 'elearn.43.tip', emoji: '🧭', level: 1 },
  { id: 44, type: 'word', english: 'Near / Far', pronunciation: 'neer / far', example: 'Is it near or far?', translationKey: 'elearn.44.tr', exampleKey: 'elearn.44.ex', tipKey: 'elearn.44.tip', emoji: '📏', level: 1 },
  { id: 45, type: 'word', english: 'Fast / Slow', pronunciation: 'faest / sloh', example: 'The delivery was fast!', translationKey: 'elearn.45.tr', exampleKey: 'elearn.45.ex', tipKey: 'elearn.45.tip', emoji: '⚡', level: 1 },
  { id: 46, type: 'word', english: 'Careful', pronunciation: 'KAIR-ful', example: 'Be careful, it\'s fragile.', translationKey: 'elearn.46.tr', exampleKey: 'elearn.46.ex', tipKey: 'elearn.46.tip', emoji: '⚠️', level: 1 },
  { id: 47, type: 'phrase', english: 'Where is the nearest...?', pronunciation: 'wer iz thuh NEER-est', example: 'Where is the nearest parking?', translationKey: 'elearn.47.tr', exampleKey: 'elearn.47.ex', tipKey: 'elearn.47.tip', emoji: '🗺️', level: 1 },
  { id: 48, type: 'grammar', english: 'Much / Many / A lot of', pronunciation: 'much / MEH-nee / uh lot uv', example: 'How much time? How many people?', translationKey: 'elearn.48.tr', exampleKey: 'elearn.48.ex', tipKey: 'elearn.48.tip', emoji: '📖', level: 2 },
  { id: 49, type: 'phrase', english: 'Take your time', pronunciation: 'tayk yor taim', example: 'No rush. Take your time.', translationKey: 'elearn.49.tr', exampleKey: 'elearn.49.ex', tipKey: 'elearn.49.tip', emoji: '🧘', level: 1 },

  // Week 8: Qualities & Opinions
  { id: 50, type: 'word', english: 'Good / Bad / Great', pronunciation: 'gud / baed / grayt', example: 'The quality is great!', translationKey: 'elearn.50.tr', exampleKey: 'elearn.50.ex', tipKey: 'elearn.50.tip', emoji: '👍', level: 1 },
  { id: 51, type: 'word', english: 'Expensive / Cheap', pronunciation: 'ik-SPEN-siv / cheep', example: 'Is it expensive?', translationKey: 'elearn.51.tr', exampleKey: 'elearn.51.ex', tipKey: 'elearn.51.tip', emoji: '💸', level: 1 },
  { id: 52, type: 'word', english: 'Problem / Solution', pronunciation: 'PRAH-blem / suh-LOO-shun', example: 'I found the solution to the problem.', translationKey: 'elearn.52.tr', exampleKey: 'elearn.52.ex', tipKey: 'elearn.52.tip', emoji: '💡', level: 1 },
  { id: 53, type: 'word', english: 'Quality', pronunciation: 'KWAH-luh-tee', example: 'We guarantee high quality.', translationKey: 'elearn.53.tr', exampleKey: 'elearn.53.ex', tipKey: 'elearn.53.tip', emoji: '🏅', level: 2 },
  { id: 54, type: 'phrase', english: 'What do you think?', pronunciation: 'wut doo yoo think', example: 'Here\'s my plan. What do you think?', translationKey: 'elearn.54.tr', exampleKey: 'elearn.54.ex', tipKey: 'elearn.54.tip', emoji: '🤔', level: 1 },
  { id: 55, type: 'grammar', english: 'Comparisons: -er / more', pronunciation: 'FAEST-ur / mor ik-SPEN-siv', example: 'This is faster. This is more expensive.', translationKey: 'elearn.55.tr', exampleKey: 'elearn.55.ex', tipKey: 'elearn.55.tip', emoji: '📖', level: 2 },
  { id: 56, type: 'phrase', english: 'Sounds good!', pronunciation: 'saundz gud', example: 'Your plan sounds good. Let\'s do it!', translationKey: 'elearn.56.tr', exampleKey: 'elearn.56.ex', tipKey: 'elearn.56.tip', emoji: '👌', level: 1 },
];

/**
 * Get today's lesson based on date.
 * Cycles through all available lessons (day of year % total).
 */
export function getDailyLesson(): DailyLesson {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 0);
  const diff = now.getTime() - start.getTime();
  const dayOfYear = Math.floor(diff / (1000 * 60 * 60 * 24));
  return lessons[dayOfYear % lessons.length];
}

/**
 * Get lesson by specific ID
 */
export function getLessonById(id: number): DailyLesson | undefined {
  return lessons.find(l => l.id === id);
}

/**
 * Get all lessons of a specific type
 */
export function getLessonsByType(type: 'word' | 'phrase' | 'grammar'): DailyLesson[] {
  return lessons.filter(l => l.type === type);
}

/**
 * Lesson type label
 */
export function lessonTypeLabel(type: string, isEn: boolean): string {
  if (type === 'word') return isEn ? 'Word of the Day' : 'Слово дня';
  if (type === 'phrase') return isEn ? 'Phrase of the Day' : 'Фраза дня';
  if (type === 'grammar') return isEn ? 'Grammar Rule' : 'Правило грамматики';
  return '';
}

/**
 * Level label
 */
export function levelLabel(level: number, isEn: boolean): string {
  if (level === 1) return isEn ? 'Beginner' : 'Начинающий';
  if (level === 2) return isEn ? 'Intermediate' : 'Средний';
  return isEn ? 'Advanced' : 'Продвинутый';
}
