import { transports as _transports, createLogger } from "winston";
import "winston-daily-rotate-file";
const dashLog = new _transports.DailyRotateFile({
  filename: "../outputs/logs/dash-%DATE%.log",
  datePattern: "YYYY-MM-DD",
  zippedArchive: true,
  maxSize: "20m",
});
const dash = createLogger({
  transports: [
    dashLog,
    new _transports.Console({
      //colorize: true,
    }),
  ],
});

export const dashLogger = dash;