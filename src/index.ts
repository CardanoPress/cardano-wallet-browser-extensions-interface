import { supportedWallets } from './config'
import CSL from './csl'
import Extension from './extension'

interface Cardano {
    enable: () => Promise<any>
    isEnabled: () => Promise<boolean>
    experimental?: {
        vespr_compat: boolean
    }
}
declare global {
    interface Window {
        cardano: {
            typhon: Promise<any>
        } & Record<string, Cardano>
    }
}

const getWalletApi = async (namespace: string) => {
    const response = await window.cardano[namespace].enable()

    if ('typhon' === namespace) {
        if (false === response.status) {
            throw response?.error ?? response.reason
        }

        return await window.cardano[namespace]
    }

    return response
}

const fromVespr = (type: string) => {
    return window.cardano[type.toLowerCase()]?.experimental?.vespr_compat || false
}

class Extensions {
    static supported = supportedWallets

    static isSupported(type: string) {
        if ('ccvault' === type) {
            type = 'Eternl'
        }

        if ('VESPR' === type) {
            return true
        }

        return supportedWallets.includes(type)
    }

    static fromVespr() {
        return supportedWallets.filter(fromVespr)
    }

    static hasWallet(type: string) {
        if (!this.isSupported(type)) {
            return false
        }

        return !!window.cardano?.[type.toLowerCase()]
    }

    static async isEnabled(type: string) {
        if (!this.hasWallet(type)) {
            return false
        }

        return window.cardano[type.toLowerCase()].isEnabled()
    }

    static async getWallet(type: string) {
        if (!this.isSupported(type)) {
            throw `Not supported wallet "${type}"`
        }

        if (!this.hasWallet(type)) {
            throw `Not available wallet "${type}"`
        }

        const namespace = type.toLowerCase()
        const object = `${namespace}Object`

        // @ts-ignore
        if (undefined === this[object] || !(await this.isEnabled(type))) {
            try {
                // @ts-ignore
                this[object] = new Extension(type, await getWalletApi(namespace))
            } catch (error: any) {
                throw typeof error === 'string' ? error : error.info || error.message || 'user abort connection'
            }
        }

        // @ts-ignore
        return Object.freeze(this[object])
    }
}

export default Extensions
export { CSL, fromVespr }
