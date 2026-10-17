/** API exposed by https://th3scr1b3.art/ecosystem-bar.js (the shared th3scr1b3 layer menu). */
interface Th3EcosystemApi {
  open: () => void;
  close: () => void;
  toggle: () => void;
  /** One visitor id shared by every *.th3scr1b3.art site (th3_sid cookie). */
  sessionId?: string;
  optOut?: () => void;
  optIn?: () => void;
}

interface Window {
  th3Ecosystem?: Th3EcosystemApi;
}
