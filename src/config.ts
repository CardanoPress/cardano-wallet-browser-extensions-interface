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
    'Nami',
    'Eternl', // ccvault
    'Yoroi',
    'Flint',
    'Typhon',
    'GeroWallet',
    'NuFi',
    'Lace',
])
