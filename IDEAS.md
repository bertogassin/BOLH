# BOLH Mobile — Идеи и оптимизации (14.02.2026)

Список всех идей и улучшений из сессии. Код восстановлен в оригинал.
Единственное применённое изменение: vite.config.ts (server.watch.ignored).

---

## 1. Vite config — Fix CPU [ПРИМЕНЕНО]
**Файл:** `apps/mobile/vite.config.ts`

Добавить `server.watch.ignored` чтобы Vite не следил за 90K+ файлами:
```ts
server: {
  watch: {
    ignored: [
      '**/target/**',           // Rust build (69K файлов!)
      '**/node_modules/**',     // Dependencies (19K файлов)
      '**/api-server/**',
      '**/backend/**',
      '**/blockchain/**',
      '**/blockchain-service/**',
      '**/mock-api/**',
      '**/shared/**',
      '**/.git/**',
      '**/dist/**',
      '**/.cargo/**',
    ],
    usePolling: false,
  },
}
```

---

## 2. ErrorBoundary — защита от крашей страниц
**Файл:** `apps/mobile/src/App.tsx`

Обернуть контент страниц в `ErrorBoundary` из SolidJS.
Когда страница падает — показывается fallback UI вместо белого экрана.

```tsx
import { ErrorBoundary } from 'solid-js';

function PageError(props: { error: any; reset: () => void; onHome: () => void }) {
  return (
    <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:60vh;padding:24px;text-align:center;">
      <div style="font-size:48px;margin-bottom:16px;">⚠️</div>
      <h2 style="color:#fff;font-size:18px;font-weight:700;margin:0 0 8px 0;">Что-то пошло не так</h2>
      <p style="color:rgba(255,255,255,0.5);font-size:13px;margin:0 0 24px 0;">Страница не смогла загрузиться</p>
      <div style="display:flex;gap:12px;">
        <button onClick={props.reset}
          style="padding:10px 20px;border-radius:12px;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;border:none;font-weight:600;font-size:14px;cursor:pointer;"
        >Повторить</button>
        <button onClick={props.onHome}
          style="padding:10px 20px;border-radius:12px;background:rgba(255,255,255,0.1);color:#fff;border:1px solid rgba(255,255,255,0.2);font-weight:600;font-size:14px;cursor:pointer;"
        >На главную</button>
      </div>
    </div>
  );
}

// Использование:
<ErrorBoundary fallback={(err, reset) => <PageError error={err} reset={reset} onHome={() => setCurrentPage('home')} />}>
  {/* ...страницы... */}
</ErrorBoundary>
```

---

## 3. LazyRetry — устойчивая lazy-загрузка
**Файл:** `apps/mobile/src/App.tsx`

Если модуль не загрузился (dev сервер перезапустился) — повторяет через 1.5с.

```tsx
function lazyRetry<T extends { default: any }>(load: () => Promise<T>) {
  return lazy(() =>
    load().catch(() =>
      new Promise<T>((resolve) =>
        setTimeout(() => resolve(load()), 1500)
      )
    )
  );
}

// Использование:
const MapPage = lazyRetry(() => import('./pages/MapPage'));
```

---

## 4. Lazy loading всех страниц
**Файл:** `apps/mobile/src/App.tsx`

Вместо одного монолита 10K строк — каждая страница в отдельном файле.
Загружается только когда пользователь переходит на неё.

**Важно:** делать ПОСТЕПЕННО, по одной странице за раз.
Не удалять код — вырезать в отдельный файл и заменить на lazy import.

---

## 5. Inline NavIcon — лёгкие иконки навигации
**Файл:** `apps/mobile/src/App.tsx`

5 SVG path для нижней навигации прямо в коде.
Не нужно грузить весь ui.tsx (76KB) ради 5 иконок.

```tsx
const NavIcon = (props: { name: string; class?: string }) => {
  const paths: Record<string, string> = {
    home: 'M219.31,108.68l-80-80a16,16,0,0,0-22.62,0l-80,80A15.87,15.87,0,0,0,32,120v96a8,8,0,0,0,8,8h64a8,8,0,0,0,8-8V160h32v56a8,8,0,0,0,8,8h64a8,8,0,0,0,8-8V120A15.87,15.87,0,0,0,219.31,108.68ZM208,208H160V152a8,8,0,0,0-8-8H104a8,8,0,0,0-8,8v56H48V120l80-80,80,80Z',
    map: 'M228.92,49.69a8,8,0,0,0-6.86-1.45L160.93,63.52,99.58,32.84a8,8,0,0,0-5.52-.6l-64,16A8,8,0,0,0,24,56V200a8,8,0,0,0,9.94,7.76l61.13-15.28,61.35,30.68A8.15,8.15,0,0,0,160,224a8,8,0,0,0,1.94-.24l64-16A8,8,0,0,0,232,200V56A8,8,0,0,0,228.92,49.69ZM104,52.94l48,24V203.06l-48-24ZM40,62.25l48-12v127.5l-48,12Zm176,131.5-48,12V78.25l48-12Z',
    layers: 'M230.91,172A8,8,0,0,1,228,182.91l-96,56a8,8,0,0,1-8.06,0l-96-56A8,8,0,0,1,36,169.09l92,53.65,92-53.65A8,8,0,0,1,230.91,172ZM220,121.09l-92,53.65L36,121.09A8,8,0,0,0,28,134.91l96,56a8,8,0,0,0,8.06,0l96-56A8,8,0,1,0,220,121.09ZM24,80a8,8,0,0,1,4-6.91l96-56a8,8,0,0,1,8.06,0l96,56a8,8,0,0,1,0,13.82l-96,56a8,8,0,0,1-8.06,0l-96-56A8,8,0,0,1,24,80Zm23.88,0L128,126.74,208.12,80,128,33.26Z',
    creditCard: 'M224,48H32A16,16,0,0,0,16,64V192a16,16,0,0,0,16,16H224a16,16,0,0,0,16-16V64A16,16,0,0,0,224,48Zm0,16V88H32V64Zm0,128H32V104H224v88Zm-16-24a8,8,0,0,1-8,8H168a8,8,0,0,1,0-16h32A8,8,0,0,1,208,168Zm-64,0a8,8,0,0,1-8,8H120a8,8,0,0,1,0-16h16A8,8,0,0,1,144,168Z',
    user: 'M230.92,212c-15.23-26.33-38.7-45.21-66.09-54.16a72,72,0,1,0-73.66,0C63.78,166.78,40.31,185.66,25.08,212a8,8,0,1,0,13.85,8c18.84-32.56,52.14-52,89.07-52s70.23,19.44,89.07,52a8,8,0,1,0,13.85-8ZM72,96a56,56,0,1,1,56,56A56.06,56.06,0,0,1,72,96Z',
  };
  return (
    <svg viewBox="0 0 256 256" fill="currentColor" class={`${props.class || ''} w-5 h-5`}>
      <path d={paths[props.name] || ''} />
    </svg>
  );
};
```

---

## 6. SwipeBack — жест "назад" свайпом
**Файл:** `apps/mobile/src/App.tsx`

Лёгкий компонент для свайпа слева для возврата назад.

```tsx
function SwipeBack(props: { onBack: () => void; children: any }) {
  let startX = 0, currentX = 0, swiping = false;
  let el: HTMLDivElement | undefined;
  return (
    <div
      ref={el}
      style="will-change:transform;min-height:100vh;"
      onTouchStart={(e: TouchEvent) => {
        if (e.touches[0].clientX > 60) return;
        startX = e.touches[0].clientX; currentX = 0; swiping = true;
        if (el) el.style.transition = 'none';
      }}
      onTouchMove={(e: TouchEvent) => {
        if (!swiping) return;
        const dx = e.touches[0].clientX - startX;
        if (dx < 0) return;
        currentX = dx;
        if (el) {
          el.style.transform = `translate3d(${dx}px,0,0)`;
          el.style.opacity = `${1 - Math.min(dx / window.innerWidth, 1) * 0.3}`;
        }
      }}
      onTouchEnd={() => {
        if (!swiping) return;
        swiping = false;
        if (currentX > window.innerWidth * 0.3) {
          if (el) {
            el.style.transition = 'transform .25s ease,opacity .25s ease';
            el.style.transform = `translate3d(${window.innerWidth}px,0,0)`;
            el.style.opacity = '0';
          }
          setTimeout(() => props.onBack(), 200);
        } else if (el) {
          el.style.transition = 'transform .25s ease,opacity .25s ease';
          el.style.transform = 'translate3d(0,0,0)';
          el.style.opacity = '1';
        }
      }}
    >{props.children}</div>
  );
}
```

---

## 7. Lazy-загрузка departments.ts в store
**Файл:** нужно создать `apps/mobile/src/store.ts` или добавить в App.tsx

`departments.ts` весит 70KB. Загружать только при первом вызове `getActiveDept()`.

```tsx
let _getDepartment: ((id: string) => any) | null = null;
export const getActiveDept = () => {
  if (!activeDepartment()) return null;
  if (!_getDepartment) {
    import('./departments').then(m => { _getDepartment = m.getDepartment; });
    return null;
  }
  return _getDepartment(activeDepartment()!);
};
```

---

## 8. MapPage — очистка Leaflet от утечек памяти
**Файл:** секция MapPage в App.tsx (или отдельный файл)

При уходе со страницы карты — убрать ВСЕ event listeners и обнулить ссылки.

```tsx
onCleanup(() => {
  workerMarkers.forEach(mk => { mk.off(); mk.remove(); });
  workerMarkers.length = 0;
  userMarker?.remove();
  userMarker = undefined;
  if (map) {
    map.off();          // Убирает ВСЕ event listeners
    tileLayer?.remove();
    map.remove();
    map = undefined as any;
  }
});
```

---

## 9. Proxy fix — прямой бэкенд вместо Traefik
**Файл:** `apps/mobile/vite.config.ts`

Поменять proxy target с `localhost:80` на `localhost:8080`.

```ts
proxy: {
  '/api/v1': { target: 'http://localhost:8080', changeOrigin: true },
  '/health': { target: 'http://localhost:8080', changeOrigin: true },
},
```

---

## 10. AuthPage — дублирующийся import
**Файл:** секция AuthPage в App.tsx

`registerUser` импортируется дважды — удалить дубликат.
Vite падает из-за этого.

---

## Порядок внедрения (рекомендация)

1. ~~Vite config~~ — уже сделано
2. Proxy fix (#9) — быстро, одна строка
3. AuthPage дубликат (#10) — быстро, одна строка
4. ErrorBoundary (#2) — добавить, не удаляя код
5. MapPage cleanup (#8) — добавить в onCleanup, не удаляя
6. Lazy departments (#7) — заменить одну функцию
7. Остальное — по мере необходимости
