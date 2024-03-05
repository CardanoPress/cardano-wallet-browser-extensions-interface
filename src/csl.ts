export class CSL {
    static Module: typeof import('@emurgo/cardano-serialization-lib-browser')

    static async load() {
        if (undefined === CSL.Module) {
            CSL.Module = await import('@emurgo/cardano-serialization-lib-browser');
        }
    }
}

export default CSL
