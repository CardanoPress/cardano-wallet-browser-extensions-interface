import type CSLType from '@emurgo/cardano-serialization-lib-browser';

export class CSL {
    static Module: typeof CSLType

    static async load() {
        if (undefined === CSL.Module) {
            CSL.Module = await import('@emurgo/cardano-serialization-lib-browser');
        }

        return CSL.Module
    }
}

export default CSL
export type { CSLType }
