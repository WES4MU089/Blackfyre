import winston from 'winston';
import path from 'path';
import fs from 'fs';
import { config } from '../config/index.js';

// Ensure logs directory exists
const logsDir = path.dirname(config.logging.file);
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

const customFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.printf(({ timestamp, level, message, stack, ...meta }) => {
    let log = `${timestamp} [${level.toUpperCase()}] ${message}`;
    if (Object.keys(meta).length > 0) {
      log += ` ${JSON.stringify(meta)}`;
    }
    if (stack) {
      log += `\n${stack}`;
    }
    return log;
  })
);

const consoleFormat = winston.format.combine(
  winston.format.colorize({ all: true }),
  winston.format.timestamp({ format: 'HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, stack }) => {
    let log = `${timestamp} ${level} ${message}`;
    if (stack) {
      log += `\n${stack}`;
    }
    return log;
  })
);

export const logger = winston.createLogger({
  level: config.logging.level,
  format: customFormat,
  transports: [
    // File transport for all logs
    new winston.transports.File({
      filename: config.logging.file,
      maxsize: 10 * 1024 * 1024, // 10MB
      maxFiles: 5,
      tailable: true,
    }),
    // Error file transport
    new winston.transports.File({
      filename: path.join(logsDir, 'error.log'),
      level: 'error',
      maxsize: 10 * 1024 * 1024,
      maxFiles: 3,
    }),
  ],
});

// Add console transport in development
if (config.server.isDev) {
  logger.add(
    new winston.transports.Console({
      format: consoleFormat,
    })
  );
}

// Stream for Morgan HTTP logging
export const httpLogStream = {
  write: (message: string) => {
    logger.info(message.trim());
  },
};

export default logger;
