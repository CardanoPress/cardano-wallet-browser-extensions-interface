import { NETWORK } from './config'
import { hexToBech32, hexToBytes } from './utils'
import * as CSL from '@emurgo/cardano-serialization-lib-browser'
import { buildTx, prepareTx } from './wallet'

class Extension {
    constructor(type, cardano) {
        this.type = type
        this.cardano = cardano
    }

    getNetwork = async () => {
        if ('Yoroi' === this.type) {
            return NETWORK[1]
        }

        let id = await this.cardano.getNetworkId()

        if ('Typhon' === this.type) {
            id = id.data
        }

        return NETWORK[id]
    }

    getBalance = async () => {
        if ('Typhon' === this.type) {
            const response = await this.cardano.getBalance()

            return response.data.ada
        }

        const balance = await this.cardano.getBalance()

        return CSL.Value.from_bytes(hexToBytes(balance)).coin().to_str()
    }

    getChangeAddress = async () => {
        if ('Typhon' === this.type) {
            const response = await this.cardano.getAddress()

            return response.data
        }

        const changeAddress = await this.cardano.getChangeAddress()

        return hexToBech32(changeAddress)
    }

    getRewardAddress = async () => {
        if ('Typhon' === this.type) {
            const response = await this.cardano.getRewardAddress()

            return response.data
        }

        if ('Cardwallet' === this.type) {
            const rewardAddress = await this.cardano.getRewardAddress()

            return hexToBech32(rewardAddress)
        }

        const rewardAddress = await this.cardano.getRewardAddresses()

        return hexToBech32(rewardAddress[0])
    }

    getUtxos = async () => {
        if ('Typhon' === this.type) {
            return []
        }

        const rawUtxos = await this.cardano.getUtxos()

        return rawUtxos.map((utxo) => CSL.TransactionUnspentOutput.from_bytes(hexToBytes(utxo)))
    }

    getStakeKeyHash = async () => {
        const rewardAddress = await this.getRewardAddress()

        return CSL.RewardAddress.from_address(
            CSL.Address.from_bech32(rewardAddress)
        ).payment_cred().to_keyhash().to_bytes()
    }

    signAndSubmit = async (transaction) => {
        if ('Typhon' === this.type) {
            throw 'No implementation from the extension'
        }

        try {
            const witnesses = await this.cardano.signTx(hexToBytes(transaction.to_bytes()).toString('hex'))
            const signedTx = CSL.Transaction.new(
                transaction.body(),
                CSL.TransactionWitnessSet.from_bytes(hexToBytes(witnesses))
            )

            return await this.cardano.submitTx(hexToBytes(signedTx.to_bytes()).toString('hex'))
        } catch (error) {
            throw error.info
        }
    }

    payTo = async (address, amount, protocolParameters = null) => {
        if ('Typhon' === this.type) {
            const { status, data, error, reason } = await this.cardano.paymentTransaction({
                outputs: [{
                    address,
                    amount,
                }],
            })

            if (status) {
                return data.transactionId
            }

            throw error ?? reason
        }

        if (!protocolParameters) {
            throw 'Required protocol parameters'
        }

        try {
            const changeAddress = await this.getChangeAddress()
            const utxos = await this.getUtxos()
            const outputs = await prepareTx(amount, address)
            const transaction = await buildTx(changeAddress, utxos, outputs, protocolParameters)

            return await this.signAndSubmit(transaction)
        } catch (error) {
            throw error
        }
    }

    delegateTo = async (poolId, protocolParameters = null, accountInformation = null) => {
        if ('Typhon' === this.type) {
            const { status, data, error, reason } = await this.cardano.delegationTransaction({
                poolId,
            })

            if (status) {
                return data.transactionId
            }

            throw error ?? reason
        }

        if (!protocolParameters) {
            throw 'Required protocol parameters'
        }

        if (!accountInformation) {
            throw 'Required account information'
        }

        try {
            const changeAddress = await this.getChangeAddress()
            const utxos = await this.getUtxos()
            const outputs = await prepareTx(protocolParameters.keyDeposit, changeAddress)
            const stakeKeyHash = await this.getStakeKeyHash()
            const certificates = CSL.Certificates.new()

            if (!accountInformation.active) {
                certificates.add(
                    CSL.Certificate.new_stake_registration(
                        CSL.StakeRegistration.new(
                            CSL.StakeCredential.from_keyhash(
                                CSL.Ed25519KeyHash.from_bytes(
                                    hexToBytes(stakeKeyHash)
                                )
                            )
                        )
                    )
                )
            }

            certificates.add(
                CSL.Certificate.new_stake_delegation(
                    CSL.StakeDelegation.new(
                        CSL.StakeCredential.from_keyhash(
                            CSL.Ed25519KeyHash.from_bytes(
                                hexToBytes(stakeKeyHash)
                            )
                        ),
                        CSL.Ed25519KeyHash.from_bytes(
                            hexToBytes(poolId)
                        )
                    )
                )
            )

            const transaction = await buildTx(changeAddress, utxos, outputs, protocolParameters, certificates)

            return await this.signAndSubmit(transaction)
        } catch (error) {
            throw error
        }
    }
}

export default Extension
