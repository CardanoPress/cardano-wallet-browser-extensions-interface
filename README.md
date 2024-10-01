# Cardano Wallet Browser Extensions Interface

A helper javascript library/package to interact with Cardano Wallets

## Installation

`npm install @pbwebdev/cardano-wallet-browser-extensions-interface`

## Supported Wallets

-   Nami
-   Eternl
-   Yoroi
-   Typhon
-   GeroWallet
-   NuFi
-   Lace
-   Begin

## Usage

Simple ADA payment to an address

```javascript
import Extensions from '@pbwebdev/cardano-wallet-browser-extensions-interface'
import { adaToLovelace } from '@pbwebdev/cardano-wallet-browser-extensions-interface/utils'

const amountInAda = 123
const wantedWallet = 'Nami'
const payeeAddress =
    'addr_test1qqr585tvlc7ylnqvz8pyqwauzrdu0mxag3m7q56grgmgu7sxu2hyfhlkwuxupa9d5085eunq2qywy7hvmvej456flknswgndm3'
const protocolParameters = {} // latest protocol parameters

const Wallet = await Extensions.getWallet(wantedWallet)
const transaction = await Wallet.payTo(payeeAddress, adaToLovelace(amountInAda), protocolParameters)

console.log('Transaction Hash', transaction)
```

Simple stake pool delegation

```javascript
import Extensions from '@pbwebdev/cardano-wallet-browser-extensions-interface'

const poolId = '6658713e2cbfa4e347691a0435953f5acbe9f03d330e94caa3a0cfb4'
const wantedWallet = 'Eternl'
const protocolParameters = {} // latest protocol parameters
const accountInformation = {} // stake account information

const Wallet = await Extensions.getWallet(wantedWallet)
const transaction = await Wallet.delegateTo(poolId, protocolParameters, accountInformation)

console.log('Transaction Hash', transaction)
```
