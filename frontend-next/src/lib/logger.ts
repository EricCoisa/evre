/**
 * Sistema de logging híbrido para funcionar em desenvolvimento e produção
 * - Server-side: console.log normal (aparece no terminal do servidor)
 * - Client-side: console.log + envio opcional para endpoint de log
 */

type LogLevel = 'info' | 'warn' | 'error' | 'debug';

interface LogData {
  level: LogLevel;
  message: string;
  data?: any;
  timestamp: string;
  context?: string;
}

class Logger {
  private isServer = typeof window === 'undefined';
  private isDevelopment = process.env.NODE_ENV === 'development';

  private formatMessage(level: LogLevel, context: string, message: string, data?: any): string {
    const prefix = `[${context.toUpperCase()}]`;
    const dataStr = data ? ` ${JSON.stringify(data, null, 2)}` : '';
    return `${prefix} ${message}${dataStr}`;
  }

  private log(level: LogLevel, context: string, message: string, data?: any) {
    const formattedMessage = this.formatMessage(level, context, message, data);
    
    // Sempre loga no console (servidor ou cliente)
    switch (level) {
      case 'error':
        console.error(formattedMessage);
        break;
      case 'warn':
        console.warn(formattedMessage);
        break;
      case 'debug':
        if (this.isDevelopment) {
          console.debug(formattedMessage);
        }
        break;
      default:
        console.log(formattedMessage);
    }

    // Em produção no cliente, também envia para o backend
    if (!this.isServer && !this.isDevelopment) {
      this.sendToBackend({
        level,
        message,
        data,
        timestamp: new Date().toISOString(),
        context,
      });
    }
  }

  private async sendToBackend(logData: LogData) {
    try {
      // Envia log para o backend de forma não-bloqueante
      fetch('/api/client-log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(logData),
        // keepalive para garantir que o log seja enviado mesmo se a página fechar
        keepalive: true,
      }).catch(() => {
        // Silenciosamente ignora erros de envio de log
      });
    } catch {
      // Silenciosamente ignora erros
    }
  }

  info(context: string, message: string, data?: any) {
    this.log('info', context, message, data);
  }

  warn(context: string, message: string, data?: any) {
    this.log('warn', context, message, data);
  }

  error(context: string, message: string, data?: any) {
    this.log('error', context, message, data);
  }

  debug(context: string, message: string, data?: any) {
    this.log('debug', context, message, data);
  }
}

export const logger = new Logger();
