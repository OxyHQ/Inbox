import { setWasmUrl } from '@lottiefiles/dotlottie-react';
import { Asset } from 'expo-asset';

let configured = false;

/** Serve dotLottie's renderer from this app's assets, as Mention does. */
export function configureLottieWeb(): void {
  if (configured) return;
  configured = true;
  const wasm = Asset.fromModule(
    require('@lottiefiles/dotlottie-web/dotlottie-player.wasm'),
  );
  setWasmUrl(wasm.uri);
}
