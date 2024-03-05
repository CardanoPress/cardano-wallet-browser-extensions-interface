import { Address } from '@emurgo/cardano-serialization-lib-browser'
import { Buffer } from 'buffer'

export const adaToLovelace = (value: string) => {
    return (parseFloat(value || '1') * 1000000).toFixed()
}

export const hexToBytes = (string: string | Uint8Array) => {
    return Buffer.from(string as string, 'hex')
}

export const hexToBech32 = (address: string) => {
    return Address.from_bytes(hexToBytes(address)).to_bech32()
}
