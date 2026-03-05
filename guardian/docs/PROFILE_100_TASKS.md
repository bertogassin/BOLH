# 100 задач: Профиль и связанные экраны

Все экраны из текущего профиля + вторые экраны по функционалу. Чеклист от А до Я.

---

## Главный экран профиля (`/profile`)

1. Показывать реальный статус верификации (verified/unverified из API), а не только «Non vérifié».
2. Сделать кликабельной карточку пользователя (переход на edit или отдельный view).
3. Кнопка «Options» (Sparkles) в шапке — добавить меню или действие (например, поделиться профилем / QR).
4. Level — формула или бэкенд (сейчас от ordersCount); опционально отдельный экран «Уровни и бонусы».
5. Orders count — тап открывает список заказов (`/orders`) с фильтром «мои».
6. Rating — тап открывает экран «Отзывы» (список отзывов по заказам/матчам).
7. Секция «Mes matchs» — при пустом списке показывать короткий текст «Aucun match pour le moment».
8. Добавить ссылку «Voir tous les matchs» → `/profile/matches` (второй экран: полный список матчей с фильтрами).
9. В блоке «My data» добавить пункт «Changer le mot de passe» → `/profile/change-password`.
10. В блоке «My data» добавить пункт «Adresses enregistrées» → `/profile/addresses` (список адресов для бронирований).
11. Блок «My Cards» — вынести в отдельный экран «Mes cartes» `/profile/cards` с полным списком и добавлением карты на втором экране.
12. На главном профиле в картах оставить только превью (2–3 карты + «Voir tout»).
13. Секция «Tableau de bord entreprise» — показывать только если user_type === 'agency' или есть флаг company_id; иначе скрыть или показывать «Devenir partenaire».
14. Добавить экран «Inscription entreprise» с формой (SIRET, nom société, etc.) и шагами.
15. Добавить экран «Tableau de bord entreprise»: список сотрудников, заказы компании, статистика.
16. В General добавить «Historique des paiements» → `/profile/payments-history`.
17. В General добавить «Notifications» → `/notifications` (уже есть; проверить ссылку из профиля).
18. Версия приложения «BOLH v2.1.0» — клик → экран «À propos» (лицензии, контакты).
19. Деконнект — подтверждение «Déconnexion ?» перед logout.
20. Состояние загрузки при первом открытии профиля (skeleton вместо спиннера).

---

## Modifier le profil (`/profile/edit`)

21. Валидация: имя/фамилия не пустые, телефон — формат.
22. Поле «Email» только для отображения (не редактируемое) или отдельный поток «Changer l’email» с подтверждением.
23. Добавить поле «Photo de profil»: загрузка аватарки (crop + API).
24. Добавить поле «Date de naissance» (опционально) и сохранять в API.
25. Добавить выбор «Langue préférée» (fr/en/ru) с сохранением в localStorage + бэкенд при наличии.
26. Кнопка «Annuler» с возвратом на `/profile` без сохранения.
27. Сообщение об успехе «Profil enregistré» (toast или inline) после сохранения.
28. Обработка ошибки сети и повторная попытка.
29. Второй экран «Changer le mot de passe»: текущий пароль, новый, confirmation; API PATCH /auth/me/password.
30. Второй экран «Changer l’email»: новый email, пароль, код по почте (если будет бэкенд).

---

## Vérification (`/profile/verification`)

31. Показывать историю заявок (pending / approved / rejected) с датами.
32. Экран «Soumettre un document»: выбор типа (ID, permis), загрузка файла, превью, отправка.
33. После отправки — статус «En cours de vérification» с примерным сроком.
34. При статусе «rejected» показывать причину и кнопку «Soumettre à nouveau».
35. Бэкенд: сохранение документа (MinIO/S3 или путь) и статус в verification_requests.
36. Админ-эндпоинт или скрипт для перевода заявки в approved и установки user.verified = true.
37. Показывать бейдж «Vérifié» на главном профиле, если verified.
38. Ссылка «Pourquoi vérifier ?» с кратким текстом преимуществ.
39. Поддержка нескольких документов (ID + proof of address).
40. Уведомление (in-app или email) при смене статуса верификации.

---

## My Cards — основной список (`/profile/cards`)

41. Отдельная страница `/profile/cards`: список всех карт с •••• last_four, brand, «Par défaut» (если одна).
42. Кнопка «Ajouter une carte» → `/profile/cards/add`.
43. На каждой карте: «Définir par défaut», «Supprimer» с подтверждением.
44. Пустое состояние: иллюстрация + «Ajoutez une carte pour payer plus vite».
45. Бэкенд: поле default_card_id у user или is_default у card.

---

## My Cards — добавление (`/profile/cards/add`)

46. Экран добавления карты: номер (маска), date d’expiration, CVC, nom sur la carte (для отображения).
47. Интеграция Stripe Elements или аналог: токенизация на клиенте, на бэкенд уходит только token (не храним PAN).
48. Валидация номера (Luhn), срока, CVC.
49. После успеха — редирект на `/profile/cards` с toast «Carte ajoutée».
50. Обработка ошибок Stripe (refused, etc.) и показ сообщения пользователю.

---

## Tableau de bord entreprise

51. Экран «Inscription entreprise» `/profile/company-register`: шаг 1 — SIRET, raison sociale, adresse.
52. Шаг 2 — контакт (email, téléphone), responsable.
53. Шаг 3 — загрузка KBis / документов компании.
54. Отправка на модерацию; статус «En attente», «Approuvé», «Refusé».
55. Экран «Tableau de bord entreprise» `/profile/company-dashboard`: сводка (nombre de gardes, missions ce mois).
56. Подэкран «Mes gardes»: список охранников компании (если есть сущность Company + Guards).
57. Подэкран «Missions»: заказы, связанные с компанией.
58. Подэкран «Facturation»: счета, реквизиты.
59. Подэкран «Paramètres entreprise»: редактирование данных компании.
60. Роль company admin: приглашение охранников по email (lien d’invitation).

---

## Paramètres (`/settings`)

61. Блок «Notifications»: push on/off, email (résumés, offres), SMS (rappels).
62. Переключатели сохранять в API (user preferences) и/или localStorage.
63. Блок «Langue»: выбор fr/en/ru с немедленным переключением.
64. Блок «Confidentialité»: кто видит профиль (public / clients only / nobody); экспорт données personnelles (GDPR).
65. Блок «Sécurité»: «Changer le mot de passe», «Sessions actives» (список устройств, déconnexion à distance).
66. Блок «À propos»: version, CGU, Politique de confidentialité, Contact.
67. Второй экран «Notifications» `/settings/notifications`: детальные настройки по типам.
68. Второй экран «Confidentialité» `/settings/privacy`: полный текст и опции.
69. Второй экран «Sécurité» `/settings/security`: пароль, 2FA (placeholder), sessions.

---

## Aide et FAQ (`/help`)

70. Список категорий FAQ (Réservation, Paiement, Vérification, Entreprise, etc.).
71. Аккордеон или отдельные страницы по каждой теме с вопросами/réponses.
72. Поиск по FAQ.
73. Блок «Contacter le support»: форма (sujet, message) или mailto + numéro.
74. Ссылки на CGU, Politique de confidentialité, Charte.
75. Второй экран «Contact support» `/help/contact` с формой и историей тикетов (если будет бэкенд).
76. Второй экран «Guide» `/help/guide`: пошаговый гайд «Comment réserver», «Comment devenir gardien».

---

## Supprimer le compte (`/profile/delete`)

77. Объяснение последствий: данные, commandes, historique.
78. Поле «Tapez SUPPRIMER pour confirmer» перед кнопкой.
79. Ввод пароля для подтверждения.
80. API DELETE /api/v1/auth/me или POST /api/v1/auth/me/deactivate с паролем.
81. После успеха: logout, редирект на главную + сообщение «Compte supprimé».
82. Опция «Désactiver temporairement» вместо удаления (soft delete).

---

## Вторые экраны по функционалу (новые)

83. `/profile/matches` — полный список матчей с фильтром par date, statut, prix.
84. `/profile/orders` — мои заказы (дублирует /orders, но из профиля; или просто ссылка на /orders).
85. `/profile/reviews` — отзывы, полученные и données; возможность ответить.
86. `/profile/addresses` — адреса для бронирований (liste + add/edit/delete).
87. `/profile/notifications` — полный список уведомлений с фильтром (уже есть /notifications; унифицировать).
88. `/profile/payments-history` — история списаний, фактуры, экспорт.
89. `/profile/about` — о приложении, версия, лицензии, контакты.
90. `/profile/security` — пароль, 2FA, активные сессии (или внутри /settings/security).
91. `/profile/invitations` — если пользователь — компания: приглашения охранников, статусы.
92. `/profile/documents` — загруженные документы (верификация, entreprise) с датами и статусами.

---

## Мелкие доработки и консистентность

93. На всех экранах профиля единый header (BOLH SECURITY + кнопка назад где нужно).
94. На всех экранах внутри профиля — BOLHNav внизу с current="profile".
95. Breadcrumb на вторых экранах: Profil > Modifier le profil.
96. Доступ к профилю без логина: показывать только CTA «Connexion» без контента (уже так).
97. После логина редирект на страницу, с которой пришли, или на /booking (как сейчас).
98. i18n: все строки профиля и дочерних экранов в en.json, ru.json, fr.json.
99. A11y: aria-labels у кнопок, focus order, контраст.
100. Тесты: E2E «открыть профиль → edit → сохранить»; «добавить карту → удалить».

---

## Краткая карта экранов

| Экран | Путь | Статус |
|-------|------|--------|
| Profil (main) | `/profile` | Есть |
| Modifier le profil | `/profile/edit` | Есть |
| Vérification | `/profile/verification` | Есть (статус) |
| Mes cartes (list) | `/profile/cards` | Добавить |
| Ajouter une carte | `/profile/cards/add` | Добавить |
| Inscription entreprise | `/profile/company-register` | Заглушка |
| Tableau de bord entreprise | `/profile/company-dashboard` | Заглушка |
| Supprimer le compte | `/profile/delete` | Заглушка |
| Paramètres | `/settings` | Заглушка |
| Aide et FAQ | `/help` | Заглушка |
| Mes matchs (full) | `/profile/matches` | Добавить |
| Changer le mot de passe | `/profile/change-password` | Добавить |
| Adresses | `/profile/addresses` | Добавить |
| Historique paiements | `/profile/payments-history` | Добавить |
| À propos | `/profile/about` | Добавить |
| Sécurité / Notifications / Confidentialité | `/settings/*` | Добавить подэкраны |

Можно брать пункты по приоритету и вводить вторые экраны по мере необходимости.
