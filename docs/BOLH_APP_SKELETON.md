# BOLH — Application Skeleton & Integration Points

Цель: показать простой интерфейс/скелет приложения и конкретные точки, куда встраивается модуль блокчейна BOLH как библиотека/локальный узел.

Основные экраны (минимум):
- Dashboard / Home — суммарный баланс, последние транзакции, быстрые действия.
- Wallet — список адресов/счётов, импорт/экспорт ключей.
- Send — форма отправки с выбором приватности (public/private), способом оплаты и комиссией.
- Receive — QR код, одноразовые адреса/stealth.
- Transactions — журнал транзакций с фильтрацией и возможностью Reveal (просмотра деталей при наличии view‑key).
- Mining & Rewards — отображение статуса майнинга/заработка за просмотр рекламы и кнопки для запуска фоновой активности.
- Referrals / Ads — управление рефералами, статистика начислений.
- Settings / Security — управление view‑keys, backup, PQ keys, node settings.

Где встраивается BOLH (integration points):
- Инициализация: при старте приложения вызывается `bolh.init(config)` (локальная библиотека или межпроцессный сервис).
- Wallet ops: создание ключей, подпись транзакций вызовами к `bolh.wallet.createKey()` / `bolh.wallet.sign(tx)`.
- Баланс / состояние: `bolh.chain.getBalance(address)`, `bolh.chain.getTxs(address, filter)`.
- Отправка транзакций: `bolh.chain.submitTx(signedTx)` — возвращает txid и события включения.
- Приватные транзакции: `bolh.privacy.createPrivateTx(...)` и reveal: `bolh.privacy.reveal(txId, viewKey)`.
- Майнинг/награждения: события из SDK `bolh.events.on('reward', handler)` и вызовы для участия в периодических активностях.
- Light client / proofs: `bolh.light.verifyProof(spvProof)` для быстрой проверки inclusion.

Примеры взаимодействия (псевдо‑API)

TypeScript интерфейс (пример):

```ts
interface BolhSDK {
  init(config: {network: 'testnet'|'mainnet', dataDir?: string}): Promise<void>;
  wallet: {
    createKey(): Promise<{pubkey:string}>;
    sign(tx: Uint8Array): Promise<Uint8Array>;
    exportViewKey(address:string): Promise<string>;
  };
  chain: {
    getBalance(address:string): Promise<number>;
    submitTx(signedTx:Uint8Array): Promise<{txid:string}>;
    getTxs(address:string, opts?:any): Promise<any[]>;
  };
  privacy: {
    createPrivateTx(params:any): Promise<Uint8Array>;
    reveal(txId:string, viewKey:string): Promise<any>;
  };
  events: {
    on(event:string, handler:(payload:any)=>void): void;
  };
}

// В реальности это будет либо native binding (SPARK/Rust core с FFI), либо WebAssembly/Native module.
```

UI flow — где вы увидите BOLH:
- Dashboard: вызов `bolh.chain.getBalance` и `bolh.chain.getTxs` при монтировании.
- Send: сбор данных у пользователя → `wallet.sign()` → `chain.submitTx()` → показать статус.
- Mining: отображение локального статуса майнинга и кнопка для включения background miner (если встроено) или подключение к пулу.

Разработка/путь к реализации
- Шаг 1: реализовать минимальный SDK/bridge (Rust native lib + TypeScript bindings) — экспорт функций из ядра BOLH.
- Шаг 2: заполнить UI‑страницы и интегрировать вызовы (как в `BolchIntegrationDemo.tsx`).
- Шаг 3: тестировать workflow (создание ключа — отправка — подтверждение — reveal).

Файл служит как визуальный/технический ориентир — следующий шаг: добавить прототип SDK и подключить demo‑компонент в мобильном приложении.
