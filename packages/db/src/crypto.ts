/**
 * Librería de cifrado de Vectra.
 * Es la ÚNICA forma de cifrar/descifrar datos en todo el proyecto.
 *
 * Uso:
 *   import { encrypt, decrypt } from '@vectra/db'
 *   const cifrado  = encrypt('postgresql://...')  // antes de persistir
 *   const original = decrypt(cifrado)              // después de leer de DB
 */

import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'

// ── Constantes del algoritmo ──────────────────────────────────────────────────
const ALGORITMO = 'aes-256-gcm'
const IV_LONGITUD   = 12  // 96 bits — longitud recomendada por NIST para GCM
const TAG_LONGITUD  = 16  // 128 bits — longitud del authentication tag
const CODIFICACION  = 'hex' as const

/**
 * Error tipado para fallas de cifrado/descifrado.
 * Permite distinguir errores de crypto de otros errores en el sistema.
 */
export class CryptoError extends Error {
  constructor(message: string, public readonly causa?: unknown) {
    super(message)
    this.name = 'CryptoError'
  }
}

/** Lee y valida la ENCRYPTION_KEY del entorno */
function obtenerClave(): Buffer {
  const hex = process.env.ENCRYPTION_KEY
  if (!hex) {
    throw new CryptoError(
      'ENCRYPTION_KEY no está definida en las variables de entorno. ' +
      'Generar con: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
    )
  }
  if (hex.length !== 64) {
    throw new CryptoError(
      `ENCRYPTION_KEY debe tener exactamente 64 caracteres hex (32 bytes). ` +
      `Longitud actual: ${hex.length}`
    )
  }
  return Buffer.from(hex, 'hex')
}

/**
 * Cifra un texto con AES-256-GCM.
 *
 * Por qué AES-256-GCM sobre AES-256-CBC:
 * ─ GCM es un modo AUTENTICADO: el Authentication Tag verifica tanto
 *   la confidencialidad como la integridad del dato. Si el texto cifrado
 *   fue alterado en la DB, decrypt() lo detecta y lanza CryptoError.
 * ─ CBC solo garantiza confidencialidad. Sin un MAC adicional es vulnerable
 *   a ataques de padding oracle (POODLE, BEAST) que permiten descifrar
 *   bloques sin conocer la clave.
 * ─ GCM es el modo recomendado por NIST SP 800-38D para cifrado en reposo.
 * ─ Cada llamada genera un IV aleatorio de 96 bits → el mismo texto
 *   produce siempre un cifrado diferente (no determinístico).
 *
 * Formato de salida: "ivHex:authTagHex:ciphertextHex" — todo en hexadecimal.
 *
 * @param texto - Texto en claro a cifrar (ej: connection string, cédula)
 * @returns String cifrado en formato "iv:authTag:ciphertext"
 * @throws {CryptoError} Si ENCRYPTION_KEY no está definida o el cifrado falla
 */
export function encrypt(texto: string): string {
  try {
    const clave = obtenerClave()
    const iv    = randomBytes(IV_LONGITUD)

    const cipher    = createCipheriv(ALGORITMO, clave, iv)
    const cifrado   = Buffer.concat([cipher.update(texto, 'utf8'), cipher.final()])
    const authTag   = cipher.getAuthTag()

    return [
      iv.toString(CODIFICACION),
      authTag.toString(CODIFICACION),
      cifrado.toString(CODIFICACION),
    ].join(':')
  } catch (err) {
    if (err instanceof CryptoError) throw err
    throw new CryptoError('Error al cifrar el dato', err)
  }
}

/**
 * Descifra un texto cifrado con encrypt().
 *
 * Si el dato fue alterado en la base de datos, el Authentication Tag
 * no coincidirá y esta función lanzará CryptoError. Esto es una
 * protección activa contra ataques de manipulación de datos.
 *
 * @param textoCifrado - String en formato "iv:authTag:ciphertext"
 * @returns Texto original en claro
 * @throws {CryptoError} Si el formato es inválido, la ENCRYPTION_KEY es
 *                       incorrecta, o el dato fue alterado (tag inválido)
 */
export function decrypt(textoCifrado: string): string {
  try {
    const partes = textoCifrado.split(':')
    if (partes.length !== 3) {
      throw new CryptoError(
        'Formato de texto cifrado inválido. Se esperaba "iv:authTag:ciphertext". ' +
        '¿El dato fue cifrado con una versión anterior del sistema?'
      )
    }

    const [ivHex, authTagHex, cifradoHex] = partes
    const clave   = obtenerClave()
    const iv      = Buffer.from(ivHex,      CODIFICACION)
    const authTag = Buffer.from(authTagHex, CODIFICACION)
    const cifrado = Buffer.from(cifradoHex, CODIFICACION)

    const decipher = createDecipheriv(ALGORITMO, clave, iv)
    decipher.setAuthTag(authTag)

    const descifrado = Buffer.concat([decipher.update(cifrado), decipher.final()])
    return descifrado.toString('utf8')
  } catch (err) {
    if (err instanceof CryptoError) throw err
    // Los errores internos del decipher (tag inválido, clave incorrecta)
    // se envuelven en CryptoError para no filtrar detalles técnicos
    throw new CryptoError(
      'Error al descifrar el dato. Causa probable: ENCRYPTION_KEY incorrecta ' +
      'o el dato fue alterado en la base de datos.',
      err
    )
  }
}
