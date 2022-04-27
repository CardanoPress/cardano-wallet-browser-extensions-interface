import { supportedWallets } from './config'
import Extension from './extension'
import * as CSL from '@emurgo/cardano-serialization-lib-browser'

const getWalletApi = async (namespace) => {
    const response = await window.cardano[namespace].enable()

    if ('typhon' === namespace) {
        if (false === response.status) {
            throw response?.error ?? response.reason
        }

        return await window.cardano[namespace]
    }

    return response
}

class Extensions {
    static supported = supportedWallets

    static isSupported(type) {
        if ('ccvault' === type) {
            type = 'Eternl'
        }

        return supportedWallets.includes(type)
    }

    static hasWallet(type) {
        if ('ccvault' === type) {
            type = 'Eternl'
        }

        if (! this.isSupported(type)) {
            return false;
        }

        return !!window.cardano?.[type.toLowerCase()]
    }

    static async getWallet(type) {
        if (! this.isSupported(type)) {
            throw `Not supported wallet "${type}"`
        }

        if (! this.hasWallet(type)) {
            throw `Not available wallet "${type}"`
        }

        const namespace = type.toLowerCase()
        const object = `${namespace}Object`

        if (undefined === this[object]) {
            try {
                this[object] = new Extension(type, await getWalletApi(namespace))
            } catch (error) {
                throw typeof error === 'string' ? error : (error.info || error.message || 'user abort connection')
            }
        }

        return Object.freeze(this[object])
    }
}

export default Extensions
export { CSL }
