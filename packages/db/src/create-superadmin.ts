#!/usr/bin/env tsx
import { config } from 'dotenv'
config({ path: '../../.env' })

/**
 * Script para crear el primer usuario SUPERADMIN en la base de datos del superadmin.
 * Los credentials NUNCA se guardan en código fuente ni en archivos de semilla.
 *
 * Uso:
 *   pnpm db:create-superadmin          ← desde la raíz del monorepo
 *   pnpm run db:create-superadmin      ← desde packages/db
 *
 * Requisitos:
 *   - DATABASE_URL_SUPERADMIN definida en .env
 *   - ENCRYPTION_KEY no es necesaria para este script
 */

import { neonConfig } from '@neondatabase/serverless'
import { PrismaClient } from '@prisma/client'
import { PrismaNeon } from '@prisma/adapter-neon'
import bcrypt from 'bcryptjs'
import ws from 'ws'
import { readLine, readPassword } from './prompt'

// Debe coincidir con SUPERADMIN_TENANT_ID en packages/auth/src/config.ts
const SUPERADMIN_TENANT_ID = '__superadmin__'

// Configurar WebSocket para Node.js (fuera del edge runtime)
neonConfig.webSocketConstructor = ws

// ── Validaciones ──────────────────────────────────────────────────────────────

function validarEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

function validarPassword(password: string): boolean {
  return password.length >= 12
}

// ── Lógica principal ──────────────────────────────────────────────────────────

async function main() {
  console.log('\n══════════════════════════════════════')
  console.log('  Crear usuario SUPERADMIN — Vectra')
  console.log('══════════════════════════════════════\n')

  // ── Solicitar email ───────────────────────────────────────────────────────
  const email = await readLine('Email: ')

  if (!validarEmail(email)) {
    console.error('\nError: El email no tiene formato válido.')
    process.exit(1)
  }

  // ── Solicitar password (oculto) ───────────────────────────────────────────
  const password = await readPassword('Contraseña (mínimo 12 caracteres): ')

  if (!validarPassword(password)) {
    console.error('\nError: La contraseña debe tener al menos 12 caracteres.')
    process.exit(1)
  }

  // ── Confirmar password ────────────────────────────────────────────────────
  const confirmacion = await readPassword('Confirmar contraseña: ')

  if (password !== confirmacion) {
    console.error('\nError: Las contraseñas no coinciden.')
    process.exit(1)
  }

  // ── Conectar a la DB del superadmin ───────────────────────────────────────
  const connectionString = process.env.DATABASE_URL_SUPERADMIN
  if (!connectionString) {
    console.error('\nError: DATABASE_URL_SUPERADMIN no está definida en .env')
    process.exit(1)
  }

  // PrismaNeon@6 recibe directamente PoolConfig — gestiona el Pool internamente
  const adapter = new PrismaNeon({ connectionString })
  const db      = new PrismaClient({ adapter })

  try {
    // ── Verificar que el email no exista ──────────────────────────────────
    // El email es único globalmente en toda la plataforma (un email = un tenant).
    const existente = await db.user.findUnique({ where: { email } })

    if (existente) {
      console.error(`\nError: Ya existe un usuario con el email "${email}".`)
      console.error('Para cambiar la contraseña usa el panel de administración.')
      process.exit(1)
    }

    // ── Crear el usuario ──────────────────────────────────────────────────
    process.stdout.write('\nCreando usuario...')

    // 12 rounds de bcrypt — balance entre seguridad y velocidad
    const passwordHash = await bcrypt.hash(password, 12)

    const usuario = await db.user.create({
      data: {
        tenantId:     SUPERADMIN_TENANT_ID,
        email,
        passwordHash,
        role:         'SUPERADMIN',
        isActive:     true,
      },
    })

    console.log(' ✓')
    console.log(`\n✓ Superadmin creado exitosamente: ${usuario.email}`)
    console.log('\nAhora puedes iniciar sesión en admin.vectra.com.co/login\n')

  } finally {
    await db.$disconnect()
  }
}

main().catch((err) => {
  console.error('\nError inesperado:', err instanceof Error ? err.message : err)
  process.exit(1)
})
