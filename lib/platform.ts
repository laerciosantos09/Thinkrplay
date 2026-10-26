// O app nativo (Android/iOS, via Capacitor) abre este mesmo site dentro de um WebView e acrescenta "ThinkrplayApp" ao User-Agent
// (ver capacitor.config.ts). Algumas coisas precisam mudar lá dentro:
//  - Google bloqueia login em WebView embutido, e a Apple só exige "Entrar com a Apple" quando há outros logins sociais;
//  - Premium: as lojas exigem a compra interna delas para conteúdo digital (o Stripe é só para a web);
//  - AdSense não funciona em app (seria AdMob).
export const isNativeApp = typeof navigator !== 'undefined' && /ThinkrplayApp/i.test(navigator.userAgent);
