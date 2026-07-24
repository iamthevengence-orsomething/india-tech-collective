/// <reference types="astro/client" />

interface ImportMetaEnv {
  /** "demo" loads fixture data (tests/local demo only); anything else loads real artifacts. */
  readonly DATA_MODE?: string;
}
