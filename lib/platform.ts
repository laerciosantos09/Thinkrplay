// O app nativo (Android/iOS, via Capacitor) abre este mesmo site dentro de um WebView e acrescenta "ThinkrplayApp" ao User-Agent
// (ver capacitor.config.ts). Algumas coisas precisam mudar lá dentro:
//  - Google bloqueia login em WebView embutido: o login social abre no navegador do sistema e volta por thinkrplay://auth (lib/native.ts);
//    as lojas exigem "Entrar com a Apple" quando há outros logins sociais, por isso os dois botões aparecem no app;
//  - Premium: as lojas exigem a compra interna delas para conteúdo digital (o Stripe é só para a web);
//  - AdSense não funciona em app (seria AdMob).
export const isNativeApp = typeof navigator !== 'undefined' && /ThinkrplayApp/i.test(navigator.userAgent);
