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
    'ccvault',
    'Yoroi',
    'Flint',
    'Typhon',
    'GeroWallet',
])

export const toPropertyName = (string, prefix = '', suffix = '') => prefix + string.charAt(0).toUpperCase() + string.slice(1) + suffix

export const browser = Object.freeze(supportedWallets.reduce((a, v) => ({
    ...a,
    [toPropertyName(v, 'has')]: () => !!window.cardano?.[v.toLowerCase()],
}), {}))
