import { NETWORK } from './config'
import { hexToBech32, hexToBytes } from './utils'
import CSL, { CSLType } from './csl'
import { buildTx, prepareTx } from './wallet'

interface Cardano {
    getNetworkId: () => Promise<keyof typeof NETWORK>;
    getBalance: () => Promise<string>;
    getAddress: () => Promise<string>;
    getChangeAddress: () => Promise<string>;
    getRewardAddress: () => Promise<string>;
    getRewardAddresses: () => Promise<string>;
    getUtxos: () => Promise<string[]>;
    signTx: (arg: string) => Promise<string>;
    submitTx: (arg: string) => Promise<string>;
    paymentTransaction: ({}) => Promise<any>;
    delegationTransaction: ({}) => Promise<any>;
}

class Extension {
    type: string;
    cardano: Cardano;

    constructor(type: string, cardano: Cardano) {
        this.type = type
        this.cardano = cardano
    }

    getNetwork = async () => {
        if ('Yoroi' === this.type) {
            return NETWORK[1]
        }

        let id = await this.cardano.getNetworkId()

        if ('Typhon' === this.type) {
            // @ts-ignore
            id = id.data
        }

        return NETWORK[id]
    }

    getBalance = async () => {
        if ('Typhon' === this.type) {
            const response = await this.cardano.getBalance()

            // @ts-ignore
            return response.data.ada as string
        }

        const balance = await this.cardano.getBalance()
        await CSL.load()

        return CSL.Module.Value.from_bytes(hexToBytes(balance)).coin().to_str()
    }

    getChangeAddress = async () => {
        if ('Typhon' === this.type) {
            const response = await this.cardano.getAddress()

            // @ts-ignore
            return response.data as string
        }

        const changeAddress = await this.cardano.getChangeAddress()

        return await hexToBech32(changeAddress)
    }

    getRewardAddress = async () => {
        if ('Typhon' === this.type) {
            const response = await this.cardano.getRewardAddress()

            // @ts-ignore
            return response.data as string
        }

        if ('Cardwallet' === this.type) {
            const rewardAddress = await this.cardano.getRewardAddress()

            return await hexToBech32(rewardAddress)
        }

        const rewardAddress = await this.cardano.getRewardAddresses()

        return await hexToBech32(rewardAddress[0])
    }

    getUtxos = async () => {
        if ('Typhon' === this.type) {
            return []
        }

        const rawUtxos = await this.cardano.getUtxos()
        await CSL.load()

        return rawUtxos.map((utxo) => CSL.Module.TransactionUnspentOutput.from_bytes(hexToBytes(utxo)))
    }

    getStakeKeyHash = async () => {
        const rewardAddress = await this.getRewardAddress()
        await CSL.load()

        return CSL.Module.RewardAddress.from_address(
            CSL.Module.Address.from_bech32(rewardAddress)
        )?.payment_cred()?.to_keyhash()?.to_bytes()!
    }

    signAndSubmit = async (transaction: CSLType.Transaction) => {
        if ('Typhon' === this.type) {
            throw 'No implementation from the extension'
        }

        try {
            await CSL.load()
            const txBytes = hexToBytes(transaction.to_bytes());
            const witnesses = await this.cardano.signTx(txBytes.toString('hex'))
            const signedTx = CSL.Module.Transaction.new(
                transaction.body(),
                CSL.Module.TransactionWitnessSet.from_bytes(hexToBytes(witnesses))
            )

            let signedBytes = hexToBytes(signedTx.to_bytes());
            return await this.cardano.submitTx(signedBytes.toString('hex'))
        } catch (error: any) {
            throw error.info
        }
    }

    payTo = async (address: string, amount: string, protocolParameters = null) => {
        if ('Typhon' === this.type) {
            const { status, data, error, reason } = await this.cardano.paymentTransaction({
                outputs: [{
                    address,
                    amount,
                }],
            })

            if (status) {
                return data.transactionId as string
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

    delegateTo = async (poolId: string, protocolParameters: any = null, accountInformation: any = null) => {
        if ('Typhon' === this.type) {
            const { status, data, error, reason } = await this.cardano.delegationTransaction({
                poolId,
            })

            if (status) {
                return data.transactionId as string
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
            await CSL.load()
            const certificates = CSL.Module.Certificates.new()

            if (!accountInformation.active) {
                certificates.add(
                    CSL.Module.Certificate.new_stake_registration(
                        CSL.Module.StakeRegistration.new(
                            CSL.Module.StakeCredential.from_keyhash(
                                CSL.Module.Ed25519KeyHash.from_bytes(
                                    hexToBytes(stakeKeyHash)
                                )
                            )
                        )
                    )
                )
            }

            certificates.add(
                CSL.Module.Certificate.new_stake_delegation(
                    CSL.Module.StakeDelegation.new(
                        CSL.Module.StakeCredential.from_keyhash(
                            CSL.Module.Ed25519KeyHash.from_bytes(
                                hexToBytes(stakeKeyHash)
                            )
                        ),
                        CSL.Module.Ed25519KeyHash.from_bytes(
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
