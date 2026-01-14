import { NextRequest, NextResponse } from 'next/server';

/**
 * Endpoint para receber logs do cliente em produção
 * Os logs do front-end serão enviados aqui e logados no servidor
 */
export async function POST(request: NextRequest) {
  try {
    const logData = await request.json();
    
    // Loga no servidor (aparecerá nos logs do servidor em produção)
    const { level, message, data, timestamp, context } = logData;
    const logMessage = `[CLIENT LOG] [${context}] ${message}`;
    
    switch (level) {
      case 'error':
        console.error(logMessage, data || '');
        break;
      case 'warn':
        console.warn(logMessage, data || '');
        break;
      default:
        console.log(logMessage, data || '');
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[CLIENT LOG ENDPOINT] Error processing log:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to process log' },
      { status: 500 }
    );
  }
}
