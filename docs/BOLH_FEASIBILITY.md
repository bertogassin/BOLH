# BOLH — Feasibility Notes (SPARK/Ada, Rust, Shell, C/C++, Go)

Кратко: цель — безопасный, квантово‑устойчивый, приватный, высокопроизводительный встроенный модуль блокчейна. Ниже — предложение по разделению ответственности между языками, ключевые зависимости, ограничения и практические шаги для прототипа.

1) Основные принципы
- Критические для безопасности модули пишутся в SPARK/Ada и формально верифицируются (консенсусная логика, начисления/экономика, проверка подписей/валидность блоков).
- Высокопроизводительные сетевые/IO/плодоносные модули пишутся на Rust (производительность, экосистема PQ‑библиотек, хорошая поддержка WebAssembly и кросс‑компиляции для Android/iOS/desktop).
- Лёгкие вспомогательные скрипты и PoC можно делать на Go/C++/Python, но для основной цепочки — SPARK + Rust.

2) Роли по модулям (рекомендация)
- SPARK/Ada:
  - Модуль проверки правил консенсуса (верификатор блоков, fork choice, reward accounting).
  - Модуль экономической логики (эмиссия, распределение 60/20/10/10, реферальные расчёты).
  - Формальные спецификации и критические проверки (immutability of accounting logic).

- Rust:
  - P2P сеть (libp2p или собственный облегчённый протокол), блок‑сниффер, mempool.
  - BFT исполнение (HotStuff/Tendermint style) и интеграция с PoW epochs.
  - Хранилище (sled/rocksdb) и state machine (state transition logic).
  - Криптография: интеграция с PQC (Rust crates для Dilithium/Kyber), BLAKE3.
  - SDK bindings: `cdylib`/FFI для SPARK/Ada (если нужно), WASM build для UI и мобильных мостов.

- C/C++:
  - Низкоуровневые оптимизации/платы мок‑драйверов при необходимости; можно использовать для платформенно‑специфичных ускорителей.

- Go:
  - Быстрый PoC для сетевых сервисов, explorer, api gateway (если команда предпочитает Go для сервисной части).

- Shell/Python:
  - Скрипты для devops, CI, тестовых сценариев, утилиты для сбора логов.

3) Пост‑квантовая криптография (практические замечания)
- Использовать CRYSTALS‑Dilithium + CRYSTALS‑Kyber. Rust‑экосистема имеет несколько реализаций/обёрток (например, PQCrypto, oqs‑rust через liboqs). Для SPARK/Ada — оборачивать проверку через доверенный интерфейс к Rust библиотеке (FFI) и формально проверять алгоритмическую логику вызова, но оставить реальные криптопримитивы в проверенных C/Rust реализациях.

4) Мобильная и встраиваемая стратегия
- Ядро сети и хранилище — Rust. Собрать `cdylib` и предоставить JNI/NDK binding для Android, и Swift/ObjC для iOS (через cbindgen или cbindgen + interop). Для Tauri — использовать Rust напрямую.
- Лёгкие light‑clients и wallet operations можно реализовать прямо на TypeScript/TSX обращаясь к нативным binding'ам.

5) Производительность и масштабирование
- Для высокой TPS — BFT комитеты обрабатывают ordering; оптимизировать сериализацию (protobuf/flatbuffers), использовать batching и parallel signature verification.
- Горизонтальное масштабирование: sharding по приложению; state sharding требует дополнительной логики распределения данных и cross‑shard atomicity (планировать в roadmap как вторичный этап).

6) Тестирование и формальная верификация
- SPARK: писать контрактные свойства и доказательства для критических алгоритмов — fork choice, reward distribution, slashing rules.
- Rust: property‑based tests, fuzzing (cargo‑afl, honggfuzz), benchmarks (criterion) и CI cross‑compile для target platforms.

7) Риски и ограничения
- Полная PQ‑защита zk‑proofs пока экспериментальна — не рассчитывать на PQ zk в начальном этапе.
- SPARK специалисты дороже и разработка потребует времени; балансировать: критические проверки — SPARK, остальное — Rust.
- Mobile binding complexity: потребуется CI на macOS (iOS) и Android setup; иметь отдельный pipeline.

8) Быстрый PoC план (минимальный набор для запуска в app)
- PoC‑0 (week 1–2):
  - Простая single‑node Rust reference: accepts txs, mempool, simple PoW epoch generator, local BFT stub that immediately finalizes blocks, persistent state (sled).
  - Expose C ABI for `init`, `create_key`, `sign_tx`, `submit_tx`, `get_balance`.
  - Integrate ABI into mobile demo page (`BolchIntegrationDemo.tsx`) via a mocked `window.bolh` binding.

- PoC‑1 (week 3–6):
  - Implement BFT committee selection by epoch seed, basic consensus round, real signature verification (Dilithium via Rust crate), and reward accounting.
  - Add privacy option: simple stealth addresses + Kyber KEM for view keys.
  - Add unit tests and basic benchmarks.

- PoC‑2 (month 2–4):
  - Harden networking (libp2p), implement mempool propagation, light client proofs, and create first Android build with native bindings.

9) Инструменты и зависимости
- Rust toolchain (stable + cross for mobile), `cargo`, `rustup`.
- libp2p, sled/rocksdb, serde/protobuf, wasm32‑unknown‑unknown target.
- SPARK/Ada toolchain (GNAT Pro или FSF GNAT + SPARK tools), интеграция с gitlab/jenkins для доказательств.
- PQ libs: `pqcrypto` crates, `liboqs` bindings (oqs‑rust) — оценить лицензии.

10) Рекомендация по очередности работ
1. Сделать Rust PoC‑0 (reference node + C ABI).  
2. Написать формальные спецификации для критических модулей (reward, fork choice) и начать SPARK реализацию параллельно.  
3. Интегрировать нативный binding в мобильный фронтенд.  
4. Расширять крипто/приватность и масштабирование (sharding) как вторую очередь.

11) Следующие конкретные шаги (я могу сделать прямо сейчас)
- Создать минимальный Rust project skeleton `bolh-core` с C ABI примитивами и примером `submit_tx` (PoC‑0).  
- Подготовить шаблоны SPARK модулей для формальной проверки reward logic.

Если да — начну с создания Rust skeleton (`crates/bolh-core`) и экспортов C ABI, затем обновлю todo‑лист (прототип на Rust — в progress). 
