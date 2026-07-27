import { Asset } from 'expo-asset';
import { File } from 'expo-file-system';

const cache = new Map<number, Promise<unknown>>();

// Reads the JSON content of a require()'d .datjson module at runtime instead of it being
// parsed and baked into the JS bundle at build time — see metro.config.js for why these
// specific files use that extension. `moduleId` is whatever `require('./foo.datjson')`
// returns (an asset reference number, since the extension is registered in assetExts).
export function loadJsonAsset<T>(moduleId: number): Promise<T> {
  const cached = cache.get(moduleId);
  if (cached) return cached as Promise<T>;

  // Only cache once the load actually succeeds — caching the in-flight promise
  // unconditionally meant a single failed load (e.g. a transient asset-copy error)
  // poisoned this moduleId forever, since every later call got the same rejected
  // promise back instead of retrying.
  const promise = (async () => {
    const asset = Asset.fromModule(moduleId);
    await asset.downloadAsync();
    const text = await new File(asset.localUri ?? asset.uri).text();
    return JSON.parse(text);
  })().catch((err) => {
    cache.delete(moduleId);
    throw err;
  });
  cache.set(moduleId, promise);
  return promise as Promise<T>;
}
