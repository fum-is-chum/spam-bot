export class Logger {
    static info(message: string) {
        console.info('\x1b[37m' + message + '\x1b[0m');
    }

    static success(message: string) {
        console.info('⚡\x1b[32m' + message + '\x1b[0m');
    }

    static highlight(message: string) {
        console.log('\x1b[36m' + message + '\x1b[0m');
    }

    static highlightValue(value: string): string {
        return '\x1b[37m' + value + '\x1b[36m';
    }

    static warn(message: string) {
        console.error('⚠️  \x1b[33m' + message + '\x1b[0m');
    }

    static error(message: string) {
        console.error('\x1b[33m' + message + '\x1b[0m');
    }
}