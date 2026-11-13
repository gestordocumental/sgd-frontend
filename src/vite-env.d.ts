/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string;
  readonly VITE_USE_MOCKS: string;
  /** URL de los Términos y Condiciones (login). Sin ella el texto no es un enlace. */
  readonly VITE_TERMS_URL?: string;
  /** URL de la Política de Tratamiento de Datos Personales (login). Sin ella no es un enlace. */
  readonly VITE_PRIVACY_URL?: string;
  /** Versión mostrada en el pie del login. */
  readonly VITE_APP_VERSION?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
