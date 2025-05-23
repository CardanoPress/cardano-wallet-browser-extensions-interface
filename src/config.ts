export const NETWORK = {
    0: 'testnet',
    1: 'mainnet',
}

export const TX = {
    too_big: 'Transaction too big',
    not_possible: 'Transaction not possible (maybe insufficient balance)',
    invalid_hereafter: 3600 * 2, //2h from current slot
}

export const supportedWallets = Object.freeze([
    'Eternl', // ccvault
    'Yoroi',
    'Typhon',
    'GeroWallet',
    'NuFi',
    'Lace',
    'Begin',
    'VESPR',
])

export type ProtocolParameters = {
    minFeeA: number
    minFeeB: number
    maxTxSize: number
    maxValSize: number
    keyDeposit: string
    poolDeposit: string
    coinsPerUtxoSize: string
    slot: number
}

export type AccountInformation = {
    active: boolean
}

export type OutputData = {
    address: string
    amount: string
}[]
