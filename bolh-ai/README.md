# BOLH AI — модуль обучения 24/7

Отдельный модуль от основного проекта Guardian. Не затрагивает Go/Next.js.

## Что здесь

- **bolh_super_learner.py** — скрипт вечного обучения: раз в час опрашивает открытые API (GitHub, Hugging Face, ArXiv), при установленных зависимостях — CrewAI и/или OpenAI для агентов и синтетики.
- **requirements.txt** — минимальные зависимости для режима «только API».

## Быстрый старт (режим без ключей)

```bash
cd bolh-ai
python -m venv .venv
.venv\Scripts\activate   # Windows
# source .venv/bin/activate  # Linux/macOS
pip install -r requirements.txt
python bolh_super_learner.py
```

Остановка: `Ctrl+C`.

## Ресурсы из твоего супер-скрипта

| Ресурс | Назначение |
|--------|------------|
| [AI-Tutorial-Codes-Included](https://github.com/marktechpost/ai-tutorial-codes) | Готовые мультиагенты, RAG, Voice AI (Jupyter, .py). Можно копировать в `ai/` и интегрировать. |
| Google Antigravity | No-code агенты, парсеры, таблицы. Использовать отдельно по документации Google. |
| Сбор данных | Web scraping (с умными парсерами), API, синтетика, first-party с согласия — всё легально. |

## Опционально: полный режим с агентами и LLM

В `requirements.txt` раскомментировать:

- `openai` — для синтетической генерации примеров.
- `crewai` — для мультиагентных сценариев (исследователь + аналитик).

Задать переменные окружения (например `OPENAI_API_KEY`), затем снова запустить `bolh_super_learner.py`.

## Интеграция с Guardian

Скрипт не вызывает API Guardian и не меняет основной проект. Результаты обучения лежат в `knowledge_base` в памяти; при необходимости можно добавить сохранение в файл/БД и вызов API Guardian из этого модуля.

## Итог

Запускаем так: из папки `bolh-ai` ставим зависимости, запускаем `python bolh_super_learner.py`. Основной проект не страдает.
