import Buffer from './buffer'
import CSL from './csl'

export const adaToLovelace = (value: string) => {
    return (parseFloat(value || '1') * 1000000).toFixed()
}

export const hexToBech32 = async (address: string) => {
    const CSLModule = await CSL.load()
    const BufferModule = await Buffer.load()

    return CSLModule.Address.from_bytes(BufferModule.from(address, 'hex')).to_bech32()
}

export const hexEncode = (message: string) => {
    let hexMessage = ''

    for (var i = 0, l = message.length; i < l; i++) {
        hexMessage += message.charCodeAt(i).toString(16)
    }

    return hexMessage
}
