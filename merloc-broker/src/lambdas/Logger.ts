const DEBUG_ENABLED: boolean = process.env.MERLOC_DEBUG_ENABLE === 'true';

export function isDebugEnabled(): boolean {
    return DEBUG_ENABLED;
}

export function debug(msg: string) {
    if (DEBUG_ENABLED) {
        console.debug('[MERLOC]', msg);
    }
}

export function info(msg: string) {
    console.info('[MERLOC]', msg);
}

export function warn(msg: string) {
    console.warn('[MERLOC]', msg);
}

export function error(msg: string, e?: Error) {
    if (e) {
        console.error('[MERLOC]', msg, e);
    } else {
        console.error('[MERLOC]', msg);
    }
}
