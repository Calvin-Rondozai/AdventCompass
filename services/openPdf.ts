import { showAlert } from '@/components/ui/AppAlert';

// Deferred require() — expo-sharing is a native module, so this file must not touch it at
// import time (a static top-level `import * as Sharing from 'expo-sharing'` would resolve
// the native module immediately, crashing this whole route — and everything else declared
// alongside it in the Stack — the moment the app hasn't been rebuilt since this dependency
// was added, same reasoning as services/noteImages.ts's getPicker()).
function getSharing() {
  return require('expo-sharing') as typeof import('expo-sharing');
}

export async function openPdf(uri: string): Promise<void> {
  let Sharing: typeof import('expo-sharing');
  try {
    Sharing = getSharing();
  } catch {
    showAlert('Not ready yet', 'This feature needs the app to be rebuilt before it can open PDFs.');
    return;
  }

  const available = await Sharing.isAvailableAsync().catch(() => false);
  if (!available) {
    showAlert('Not supported', "This device can't open shared files.");
    return;
  }
  try {
    await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: 'Open with…' });
  } catch {
    showAlert("Couldn't open", 'Something went wrong opening this PDF.');
  }
}
