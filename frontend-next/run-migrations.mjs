#!/usr/bin/env node
import { getPayload } from 'payload'
import config from './payload.config.js'

async function runMigrations() {
  try {
    console.log('🔄 Running Payload migrations...')
    
    const payload = await getPayload({ config })
    await payload.db.migrate()
    
    console.log('✅ Migrations completed successfully')
    process.exit(0)
  } catch (error) {
    console.error('❌ Migration failed:', error)
    process.exit(1)
  }
}

runMigrations()
