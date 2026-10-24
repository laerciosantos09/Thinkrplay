/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  readonly VITE_SUPPORT_EMAIL?: string;
  readonly VITE_ADSENSE_CLIENT?: string;
  readonly VITE_ADSENSE_SLOT_HOME?: string;
  readonly VITE_ADSENSE_SLOT_RANKING?: string;
  readonly VITE_ADSENSE_SLOT_RESULT?: string;
  readonly VITE_ADSENSE_TEST?: string;
  readonly VITE_PREMIUM_PRICE_LABEL?: string;
}
