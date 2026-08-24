type LogFields = Record<string, unknown>;

function format(level: string, message: string, fields?: LogFields) {
  const time = new Date().toISOString();
  const suffix = fields ? ` ${JSON.stringify(fields)}` : "";
  return `[${time}] [${level}] ${message}${suffix}`;
}

export const logger = {
  info(message: string, fields?: LogFields) {
    console.log(format("INFO", message, fields));
  },
  warn(message: string, fields?: LogFields) {
    console.warn(format("WARN", message, fields));
  },
  error(message: string, fields?: LogFields) {
    console.error(format("ERROR", message, fields));
  },
  debug(message: string, fields?: LogFields) {
    if (process.env.DEBUG) {
      console.debug(format("DEBUG", message, fields));
    }
  },
};
