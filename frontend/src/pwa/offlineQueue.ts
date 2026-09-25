/**
 * Fila de operações pendentes de sincronização (seção 26 do briefing).
 * IndexedDB puro (sem dependência nova) — sobrevive a reload/fechar aba,
 * ao contrário de um array em memória. Só mutações (POST/PUT/PATCH/DELETE)
 * feitas de verdade offline entram aqui; GET nunca é enfileirado.
 */

const DB_NAME = 'oeste-freios-offline';
const STORE_NAME = 'pending-operations';
const DB_VERSION = 1;

/** Disparado no window quando a fila muda — a tela de pendências escuta para recarregar. */
export const OFFLINE_QUEUE_CHANGED = 'oeste-offline-queue-changed';

export interface PendingOperation {
  id: number;
  method: 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  path: string;
  body: unknown;
  /** Enviada como Idempotency-Key no replay: se a 1ª tentativa chegou ao servidor sem o app ver a resposta, não duplica. */
  idempotencyKey?: string;
  /** Motivo da última falha (exibido na tela de pendências). */
  lastError?: string;
  /** Texto curto pro usuário entender o que está pendente (ex. "Alterar status da OS #1234"). */
  description: string;
  createdAt: string;
  status: 'pending' | 'failed';
  /** Ausente apenas em registros legados, que nunca podem ser reenviados automaticamente. */
  ownerUserId?: string;
}

export function operationBelongsToUser(op: PendingOperation, userId: string): boolean {
  return Boolean(userId && op.ownerUserId === userId);
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function withStore<T>(
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, mode);
    const store = tx.objectStore(STORE_NAME);
    const request = fn(store);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    tx.oncomplete = () => db.close();
  });
}

export async function enqueueOperation(
  op: Omit<PendingOperation, 'id' | 'createdAt' | 'status' | 'ownerUserId'> & {
    ownerUserId: string;
  },
): Promise<number> {
  if (!op.ownerUserId) throw new Error('Usuário necessário para guardar uma alteração offline.');
  const full: Omit<PendingOperation, 'id'> = {
    ...op,
    createdAt: new Date().toISOString(),
    status: 'pending',
  };
  const id = await withStore('readwrite', (store) => store.add(full) as IDBRequest<number>);
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(OFFLINE_QUEUE_CHANGED));
  return id;
}

export async function getAllOperations(): Promise<PendingOperation[]> {
  return withStore('readonly', (store) => store.getAll() as IDBRequest<PendingOperation[]>);
}

export async function removeOperation(id: number): Promise<void> {
  await withStore('readwrite', (store) => store.delete(id));
}

export async function markOperationFailed(id: number, lastError?: string): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const getReq = store.get(id);
    getReq.onsuccess = () => {
      const op = getReq.result as PendingOperation | undefined;
      if (op) {
        op.status = 'failed';
        op.lastError = lastError;
        store.put(op);
      }
    };
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => reject(tx.error);
  });
}

/** Volta uma operação com falha para a fila (o usuário pediu para tentar de novo). */
export async function retryOperation(id: number): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const getReq = store.get(id);
    getReq.onsuccess = () => {
      const op = getReq.result as PendingOperation | undefined;
      if (op) {
        op.status = 'pending';
        delete op.lastError;
        store.put(op);
      }
    };
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => reject(tx.error);
  });
}

export async function clearOfflineQueue(): Promise<void> {
  await withStore('readwrite', (store) => store.clear());
}

export async function countPending(): Promise<number> {
  const all = await getAllOperations();
  return all.length;
}
