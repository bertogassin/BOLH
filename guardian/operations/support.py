"""
Система поддержки: тикеты, приоритеты, SLA, автоответы из базы знаний.
"""
from enum import Enum
from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional


class TicketPriority(int, Enum):
    LOW = 1
    MEDIUM = 2
    HIGH = 3
    URGENT = 4


class SupportSystem:
    def __init__(self):
        self.tickets: List[Dict[str, Any]] = []
        self.sla_targets = {
            TicketPriority.LOW: 24 * 60,
            TicketPriority.MEDIUM: 4 * 60,
            TicketPriority.HIGH: 60,
            TicketPriority.URGENT: 15,
        }
        self._knowledge_base = {
            "как создать заказ": {"response": "Нажмите «+» на главном экране и следуйте инструкциям.", "resolved": False},
            "не пришли деньги": {"response": "Проверьте раздел «Кошелёк». Обычно выплата в течение 24 часов.", "resolved": False},
            "забыл пароль": {"response": "На экране входа нажмите «Забыли пароль?»", "resolved": True},
        }

    def create_ticket(
        self,
        user_id: str,
        issue_type: str,
        description: str,
        priority: Optional[TicketPriority] = None,
    ) -> Dict[str, Any]:
        if priority is None:
            priority = self.determine_priority(issue_type, description)
        ticket = {
            "id": f"TICKET-{len(self.tickets) + 1}",
            "user_id": user_id,
            "issue_type": issue_type,
            "description": description,
            "priority": priority,
            "status": "open",
            "created_at": datetime.now(),
            "sla_deadline": datetime.now() + timedelta(minutes=self.sla_targets[priority]),
            "assigned_to": None,
            "messages": [],
            "tags": self.extract_tags(description),
        }
        auto = self.try_auto_response(ticket)
        if auto:
            ticket["auto_response_sent"] = True
            ticket["messages"].append({"from": "bot", "message": auto["response"], "timestamp": datetime.now()})
            if auto.get("resolved"):
                ticket["status"] = "resolved_by_bot"
        else:
            ticket["assigned_to"] = "agent_1"
        self.tickets.append(ticket)
        return ticket

    def determine_priority(self, issue_type: str, description: str) -> TicketPriority:
        d = description.lower()
        if any(k in d for k in ["не могу зайти", "деньги не пришли", "срочно", "опасность"]):
            return TicketPriority.URGENT
        if any(k in d for k in ["ошибка", "не работает", "проблема"]):
            return TicketPriority.HIGH
        if issue_type in ("payment", "security"):
            return TicketPriority.MEDIUM
        return TicketPriority.LOW

    def try_auto_response(self, ticket: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        d = ticket["description"].lower()
        for key, value in self._knowledge_base.items():
            if key in d:
                return value
        return None

    def extract_tags(self, description: str) -> List[str]:
        tags = []
        if "оплата" in description.lower() or "деньги" in description.lower():
            tags.append("payment")
        if "ошибка" in description.lower():
            tags.append("bug")
        return tags

    def get_first_response_time(self, ticket: Dict[str, Any]) -> Optional[float]:
        for msg in ticket.get("messages", []):
            if msg.get("from") != "bot":
                created = ticket.get("created_at")
                if created and hasattr(created, "timestamp"):
                    return (msg["timestamp"].timestamp() - created.timestamp()) / 60
        return None

    def get_sla_compliance(self) -> Dict[str, Any]:
        total = len(self.tickets)
        breached = 0
        total_response_time = 0
        response_count = 0
        by_priority = {}
        for ticket in self.tickets:
            p = ticket["priority"]
            if p not in by_priority:
                by_priority[p] = {"total": 0, "breached": 0}
            by_priority[p]["total"] += 1
            t = self.get_first_response_time(ticket)
            if t is not None:
                response_count += 1
                total_response_time += t
                if t > self.sla_targets.get(p, 60) * 60 / 60:
                    by_priority[p]["breached"] += 1
                    breached += 1
        return {
            "total_tickets": total,
            "by_priority": by_priority,
            "breached": breached,
            "avg_response_time": total_response_time / response_count if response_count else 0,
        }
