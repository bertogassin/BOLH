# bolh_super_learner.py
"""
BOLH SUPER LEARNER v1.0
Учится 24/7, легально, связывает со всем миром.
Зависимости: aiohttp (остальное опционально).
"""
import asyncio
from datetime import datetime
from typing import Any, Dict, List

try:
    import aiohttp
except ImportError:
    aiohttp = None


class BOLHSuperLearner:
    """
    Ядро вечного обучения BOLH AI.
    Работает без OpenAI/CrewAI (режим API-only); с ключами — полный режим.
    """

    def __init__(self) -> None:
        self.knowledge_base: Dict[str, Any] = {}
        self.learning_sources: List[Any] = [
            self._learn_from_web,
            self._connect_to_world,
        ]
        if self._has_agents():
            self.learning_sources.insert(1, self._learn_from_agents)
        if self._has_openai():
            self.learning_sources.insert(2, self._learn_from_synthetic)

    @staticmethod
    def _has_agents() -> bool:
        try:
            from crewai import Agent, Task, Crew  # noqa: F401
            return True
        except ImportError:
            return False

    @staticmethod
    def _has_openai() -> bool:
        try:
            import openai  # noqa: F401
            return bool(openai.api_key if hasattr(openai, "api_key") else True)
        except ImportError:
            return False

    async def learn_forever(self, interval_seconds: int = 3600) -> None:
        """
        Бесконечный цикл обучения (24/7).
        interval_seconds: пауза между циклами (по умолчанию 1 час).
        """
        print("BOLH SUPER LEARNER АКТИВИРОВАН")
        print("Учусь 24/7 (интервал {} с)...".format(interval_seconds))

        while True:
            try:
                for source in self.learning_sources:
                    try:
                        await source()
                    except Exception as e:
                        print("Источник {}: {}".format(source.__name__, e))

                await self._sync_knowledge()
                await asyncio.sleep(interval_seconds)
            except Exception as e:
                print("Ошибка цикла: {}, продолжаю через 60 с...".format(e))
                await asyncio.sleep(60)

    async def _learn_from_web(self) -> None:
        """Учится из интернета (легально через API)."""
        if not aiohttp:
            print("aiohttp не установлен, пропуск _learn_from_web")
            return

        sources = [
            "https://api.github.com/repos/marktechpost/ai-tutorial-codes",
            "https://huggingface.co/api/models?limit=5",
        ]

        async with aiohttp.ClientSession() as session:
            for source in sources:
                try:
                    async with session.get(source) as resp:
                        if resp.status != 200:
                            continue
                        data = await resp.json()
                        self._process_knowledge(source, data)
                        print("Получены данные: {}".format(source[:50]))
                except Exception as e:
                    print("Ошибка запроса {}: {}".format(source[:40], e))

    async def _learn_from_agents(self) -> None:
        """Запускает мультиагентные системы (CrewAI), если установлены."""
        try:
            from crewai import Agent, Task, Crew

            researcher = Agent(
                role="Исследователь",
                goal="Находить новые AI-технологии и методы",
                backstory="Ищу новое в мире AI 24/7",
            )
            analyst = Agent(
                role="Аналитик",
                goal="Анализировать данные и извлекать знания",
                backstory="Превращаю сырые данные в знания",
            )
            crew = Crew(
                agents=[researcher, analyst],
                tasks=[
                    Task("Найти 5 новых AI-репозиториев на GitHub", agent=researcher),
                    Task("Извлечь ключевые алгоритмы", agent=analyst),
                ],
            )
            result = crew.kickoff()
            self.knowledge_base["crew_result"] = {
                "data": str(result),
                "timestamp": datetime.now().isoformat(),
                "processed": True,
            }
            print("CrewAI: цикл выполнен")
        except Exception as e:
            print("CrewAI недоступен: {}".format(e))

    async def _learn_from_synthetic(self) -> None:
        """Генерирует синтетические данные (OpenAI), если ключ задан."""
        try:
            import openai
            prompt = "Сгенерируй 3 примера задач для AI-агента (финансы, медицина, образование) с кратким ответом."
            response = openai.chat.completions.create(
                model="gpt-4o-mini",
                messages=[{"role": "user", "content": prompt}],
            )
            text = response.choices[0].message.content if response.choices else ""
            self.knowledge_base["synthetic"] = {
                "data": text,
                "timestamp": datetime.now().isoformat(),
                "processed": True,
            }
            print("Синтетические данные обновлены")
        except Exception as e:
            print("OpenAI синтетика пропущена: {}".format(e))

    async def _connect_to_world(self) -> None:
        """Связывается с открытыми API мира."""
        if not aiohttp:
            return

        world_apis = {
            "github_ai": "https://api.github.com/search/repositories?q=ai&per_page=5",
            "arxiv": "http://export.arxiv.org/api/query?search_query=ai&max_results=3",
        }

        async with aiohttp.ClientSession() as session:
            for name, url in world_apis.items():
                try:
                    async with session.get(url) as resp:
                        if resp.status != 200:
                            continue
                        ct = resp.headers.get("Content-Type", "")
                        if "json" in ct:
                            world_data = await resp.json()
                        else:
                            world_data = await resp.text()
                        self.knowledge_base["world_{}".format(name)] = {
                            "data": world_data,
                            "timestamp": datetime.now().isoformat(),
                            "processed": False,
                        }
                        print("Связался с {}".format(name))
                except Exception as e:
                    print("{}: {}".format(name, e))

    async def _sync_knowledge(self) -> None:
        """Синхронизация/дедубликация знаний (заглушка под Часть 6 Purifier)."""
        keys = list(self.knowledge_base.keys())
        if keys:
            print("База знаний: {} записей".format(len(keys)))

    def _process_knowledge(self, source: str, data: Any) -> None:
        """Обрабатывает и сохраняет знания с метаданными."""
        self.knowledge_base[source] = {
            "data": data,
            "timestamp": datetime.now().isoformat(),
            "processed": True,
        }


def main() -> None:
    learner = BOLHSuperLearner()
    try:
        asyncio.run(learner.learn_forever(interval_seconds=3600))
    except KeyboardInterrupt:
        print("\nОстановлено пользователем.")


if __name__ == "__main__":
    main()
