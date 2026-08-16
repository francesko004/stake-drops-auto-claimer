/**
 * Structured logger for Stake Auto-Claim extension.
 */

export class Logger {
  private tag: string;
  private static debugEnabled: boolean = false;

  constructor(tag: string) {
    this.tag = tag;
  }

  public static setDebug(enabled: boolean): void {
    Logger.debugEnabled = enabled;
  }

  public static isDebug(): boolean {
    return Logger.debugEnabled;
  }

  private formatMessage(msg: string): string {
    const time = new Date().toISOString().substring(11, 19);
    return `[${time}] [StakeAutoClaim:${this.tag}] ${msg}`;
  }

  public info(message: string, ...args: unknown[]): void {
    console.log(this.formatMessage(message), ...args);
  }

  public debug(message: string, ...args: unknown[]): void {
    if (Logger.debugEnabled) {
      console.debug(this.formatMessage(message), ...args);
    }
  }

  public warn(message: string, ...args: unknown[]): void {
    console.warn(this.formatMessage(message), ...args);
  }

  public error(message: string, ...args: unknown[]): void {
    console.error(this.formatMessage(message), ...args);
  }
}
