import { Asset } from 'expo-asset';

const cache = new Map<number, Promise<string>>();

// Resolves a require()'d module id (an asset bundled per metro.config.js's assetExts) to
// a local file:// URI Expo's audio player can open — same on-demand-download-then-cache
// shape as database/loadJsonAsset.ts, just returning the file's URI instead of parsing it
// as JSON.
export function resolveAssetUri(moduleId: number): Promise<string> {
  const cached = cache.get(moduleId);
  if (cached) return cached;

  const promise = (async () => {
    const asset = Asset.fromModule(moduleId);
    await asset.downloadAsync();
    return asset.localUri ?? asset.uri;
  })().catch((err) => {
    cache.delete(moduleId);
    throw err;
  });
  cache.set(moduleId, promise);
  return promise;
}
