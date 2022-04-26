import { Address } from '@emurgo/cardano-serialization-lib-browser'
import { Buffer } from 'buffer'

export const adaToLovelace = (value) => {
    return (parseFloat(value || '1') * 1000000).toFixed()
}

export const hexToBytes = (string) => {
    return Buffer.from(string, 'hex')
}

export const hexToBech32 = (address) => {
    return Address.from_bytes(hexToBytes(address)).to_bech32()
}
