"""
Виральный движок: реферальные ссылки, QR, шаринг в соцсети, K-factor.
"""
import hashlib
from datetime import datetime
from typing import Dict, Any, Optional
import base64

try:
    import qrcode
    from io import BytesIO
    HAS_QR = True
except ImportError:
    HAS_QR = False


class ViralEngine:
    def __init__(self):
        self.referral_rewards = {"inviter": 1000, "friend": 500, "max_per_user": 10000}

    def generate_referral_link(self, user_id: str) -> str:
        code = hashlib.md5(f"{user_id}_{datetime.now().timestamp()}".encode()).hexdigest()[:8]
        return f"https://guardian.app/r/{code}"

    def generate_qr_code(self, user_id: str) -> str:
        link = self.generate_referral_link(user_id)
        if not HAS_QR:
            return ""
        qr = qrcode.QRCode(version=1, box_size=10, border=5)
        qr.add_data(link)
        qr.make(fit=True)
        img = qr.make_image(fill_color="black", back_color="white")
        buf = BytesIO()
        img.save(buf, format="PNG")
        return f"data:image/png;base64,{base64.b64encode(buf.getvalue()).decode()}"

    def get_referral_stats(self, user_id: str, count_referrals: int = 0, sum_bonus: float = 0) -> Dict[str, Any]:
        return {
            "total_referrals": count_referrals,
            "total_earned": sum_bonus,
            "referral_link": self.generate_referral_link(user_id),
            "qr_code": self.generate_qr_code(user_id),
        }

    def create_referral_campaign(self, user_id: str, message: str) -> Dict[str, str]:
        link = self.generate_referral_link(user_id)
        return {
            "whatsapp": f"https://wa.me/?text={message} {link}",
            "telegram": f"https://t.me/share/url?url={link}&text={message}",
            "vk": f"https://vk.com/share.php?url={link}&title={message}",
        }


def calculate_k_factor(users: int, referrals: int, conversion_rate: float) -> float:
    if users <= 0:
        return 0.0
    invites_per_user = referrals / users
    return invites_per_user * conversion_rate
