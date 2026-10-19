// Desktop mirror: writes the JSON file layout into a real folder via the File System Access API.
// createWritable() writes to a swap file and replaces the original on close(), so each write is atomic.
import { db } from './db';
import { parseFiles, type AppData } from './files';

type DirHandle = FileSystemDirectoryHandle & {
  queryPermission?: (o: { mode: 'readwrite' }) => Promise<PermissionState>;
  requestPermission?: (o: { mode: 'readwrite' }) => Promise<PermissionState>;
  values?: () => AsyncIterable<FileSystemHandle>;
};

const HANDLE_KEY = 'folderHandle';

export const folderSupported = () => typeof window !== 'undefined' && 'showDirectoryPicker' in window;

export async function getFolder(): Promise<DirHandle | null> {
  const row = await db.kv.get(HANDLE_KEY);
  return (row?.value as DirHandle) ?? null;
}

export async function pickFolder(): Promise<DirHandle | null> {
  if (!folderSupported()) return null;
  const handle = (await (window as unknown as { showDirectoryPicker: (o: object) => Promise<DirHandle> }).showDirectoryPicker({
    id: 'kalori',
    mode: 'readwrite',
  })) as DirHandle;
  await db.kv.put({ key: HANDLE_KEY, value: handle });
  return handle;
}

export const forgetFolder = () => db.kv.delete(HANDLE_KEY);

/** True if we may write without a prompt; `ask` may show the permission prompt (needs a user gesture). */
export async function ensurePermission(h: DirHandle, ask = false): Promise<boolean> {
  if (!h.queryPermission) return true;
  if ((await h.queryPermission({ mode: 'readwrite' })) === 'granted') return true;
  if (!ask || !h.requestPermission) return false;
  return (await h.requestPermission({ mode: 'readwrite' })) === 'granted';
}

async function dirFor(root: DirHandle, path: string, create: boolean): Promise<[FileSystemDirectoryHandle, string]> {
  const parts = path.split('/');
  const name = parts.pop()!;
  let dir: FileSystemDirectoryHandle = root;
  for (const p of parts) dir = await dir.getDirectoryHandle(p, { create });
  return [dir, name];
}

export async function writeFiles(root: DirHandle, files: Record<string, string | Blob>) {
  for (const [path, content] of Object.entries(files)) {
    const [dir, name] = await dirFor(root, path, true);
    const fh = await dir.getFileHandle(name, { create: true });
    const w = await fh.createWritable();
    await w.write(content);
    await w.close();
  }
}

/** Reads a previously written folder back into AppData (desktop import). */
export async function readFolder(root: DirHandle): Promise<AppData> {
  const getFile = async (path: string) => {
    try {
      const [dir, name] = await dirFor(root, path, false);
      return await (await dir.getFileHandle(name)).getFile();
    } catch {
      return null;
    }
  };
  const list = async (path: string) => {
    try {
      const dir = (await root.getDirectoryHandle(path)) as DirHandle;
      const names: string[] = [];
      for await (const h of dir.values!()) if (h.kind === 'file') names.push(h.name);
      return names;
    } catch {
      return [];
    }
  };
  return parseFiles(async (p) => (await getFile(p))?.text() ?? null, list, getFile);
}
