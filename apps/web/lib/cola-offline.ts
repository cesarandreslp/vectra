/**
 * Cola en IndexedDB para lo que se captura en la calle sin señal. Cada item
 * lleva su id, así que vaciar la cola dos veces (o subir un lote que ya había
 * llegado) no duplica nada en el servidor. Sin dependencias: IndexedDB nativo.
 * Solo cliente.
 */

const DB = 'vectra-offline'
const STORE = 'contactos-calle'

function abrir(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'id' })
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function tx<T>(modo: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await abrir()
  return new Promise((resolve, reject) => {
    const req = fn(db.transaction(STORE, modo).objectStore(STORE))
    req.onsuccess = () => { resolve(req.result); db.close() }
    req.onerror = () => { reject(req.error); db.close() }
  })
}

export function encolar<T extends { id: string }>(item: T): Promise<IDBValidKey> {
  return tx('readwrite', (s) => s.put(item))
}

export function pendientes<T>(): Promise<T[]> {
  return tx('readonly', (s) => s.getAll() as IDBRequest<T[]>)
}

export async function quitar(ids: string[]): Promise<void> {
  for (const id of ids) await tx('readwrite', (s) => s.delete(id))
}
