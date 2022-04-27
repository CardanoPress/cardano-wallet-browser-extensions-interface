# Cardano Wallet Browser Extensions Interface

A helper javascript library/package to interact with Cardano Wallets

## Installation

`npm install @pbwebdev/cardano-wallet-browser-extensions-interface`

## Supported Wallets

- Nami
- Eternl `ccvault`
- Yoroi
- Flint
- Typhon
- GeroWallet

## Usage

```javascript
import Extensions from '@pbwebdev/cardano-wallet-browser-extensions-interface'
import { adaToLovelace } from '@pbwebdev/cardano-wallet-browser-extensions-interface/utils'
import { buildTx, prepareTx } from '@pbwebdev/cardano-wallet-browser-extensions-interface/wallet'

const amountInAda = 123
const wantedWallet = 'Nami'
const payeeAddress = 'addr_test1qqr585tvlc7ylnqvz8pyqwauzrdu0mxag3m7q56grgmgu7sxu2hyfhlkwuxupa9d5085eunq2qywy7hvmvej456flknswgndm3'

const Wallet = await Extensions.getWallet(wantedWallet)
const changeAddress = await Wallet.getChangeAddress()
const utxos = await Wallet.getUtxos()
const outputs = await prepareTx(adaToLovelace(amountInAda), payeeAddress)
const protocolParameters = {} // latest protocol parameters
const transaction = await buildTx(changeAddress, utxos, outputs, protocolParameters)

console.log('Transaction Hash', await Wallet.signAndSubmit(transaction))
```
