import type { Buffer as BufferType } from 'buffer'

export class Buffer {
    static Module: typeof BufferType

    static async load() {
        if (undefined === Buffer.Module) {
            Buffer.Module = (await import('buffer')).Buffer
        }

        return Buffer.Module
    }
}

export default Buffer
export type { BufferType }
