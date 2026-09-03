export function ThemeBootstrap() {
  const code = `(function(){try{var t=localStorage.getItem('bolh-theme');if(t!=='light'&&t!=='dark'){t=matchMedia('(prefers-color-scheme: light)').matches?'light':'dark'}document.documentElement.dataset.theme=t;document.documentElement.style.colorScheme=t}catch(e){document.documentElement.dataset.theme='dark'}})()`
  return <script dangerouslySetInnerHTML={{ __html: code }} />
}
