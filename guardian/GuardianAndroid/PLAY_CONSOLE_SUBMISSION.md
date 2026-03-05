# Play Console Submission Pack (BOLH Security)

Use this file as a copy/paste source while filling Play Console.

## App Identity

- App name: `BOLH Security`
- Package name: `com.guardian.android`
- Category: `Business`
- Track (first rollout): `Internal testing`

## Store Listing Texts

### Short description (80 chars max)
On-demand security services with fast booking and account control.

### Full description
BOLH Security helps users request trusted security services quickly and manage orders in one place.

With the app you can:
- Create and manage your account
- Book security services
- Track and manage requests
- Configure app settings for language, sound, and theme
- Use secure authentication and account controls

Privacy and safety:
- Data is transmitted using secure HTTPS connections in production
- Users can request account and data deletion from within the app or via support

Support: support@bolh-security.com

## Release Notes (Internal Testing)

### English
Initial internal beta release.
- Account registration and login
- Booking and profile flows
- Offline fallback and reconnect behavior
- Security hardening for release configuration

### Russian
Первая внутренняя бета-версия.
- Регистрация и вход
- Основные сценарии бронирования и профиля
- Оффлайн-режим и повторное подключение
- Усиленные настройки безопасности для релиза

## Data Safety (Starter Answers)

These are starter answers. Keep only what is true for your app.

- Does app collect or share data: `Yes`
- Data types collected:
  - Personal info -> Name
  - Personal info -> Email address
  - Personal info -> Phone number (if collected in profile)
- Purpose:
  - App functionality
  - Account management
  - Security and fraud prevention
- Data shared with third parties: `No` (if true)
- Is data encrypted in transit: `Yes`
- Can users request data deletion: `Yes` (supported via in-app delete page / support)

## Legal URLs

- Privacy Policy URL: `https://app.bolhsecurity.com/legal/privacy`
- Terms URL: `https://app.bolhsecurity.com/legal/terms`

## Required Graphics and Assets

- App icon: `512 x 512` PNG
- Feature graphic: `1024 x 500` PNG
- Phone screenshots: at least `2`
- Optional tablet screenshots: recommended

## Final Upload Checklist

- [ ] `preflight-release.ps1` passes
- [ ] `release-all.ps1` builds bundle
- [ ] `app-release.aab` generated
- [ ] Internal testing release created
- [ ] Testers added
