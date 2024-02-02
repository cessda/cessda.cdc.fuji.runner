import winston, { transports as _transports } from "winston";
import "winston-daily-rotate-file";

const logLevel = process.env['SEARCHKIT_LOG_LEVEL'] || 'info';
function loggerFormat() {
  if (process.env['SEARCHKIT_USE_JSON_LOGGING'] === 'true') {
    return winston.format.json();
  } else {
    return winston.format.printf(
      ({ level, message, timestamp }) => `[${timestamp}][${level}] ${message}`
    );
  }
}

const commonSettings: winston.transport.TransportStreamOptions = {
  handleExceptions: true,
  handleRejections: true
};

const dashLog = new _transports.DailyRotateFile({
  ...commonSettings,
  filename: "../outputs/logs/dash-%DATE%.log",
  datePattern: "YYYY-MM-DD",
  zippedArchive: true,
  maxSize: "20m"
});

export const logger = winston.createLogger({
  level: logLevel,
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.splat(),
    loggerFormat()
  ),
  transports: [
    new winston.transports.Console(commonSettings),
    dashLog
  ]
});
