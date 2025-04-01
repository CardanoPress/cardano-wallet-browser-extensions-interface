import Buffer from './buffer'
import { AccountInformation, NETWORK, OutputData, ProtocolParameters } from './config'
import CSL, { CSLType } from './csl'
import { hexEncode, hexToBech32 } from './utils'
import { buildTx, prepareTx } from './wallet'

interface Cardano {
    getNetworkId: () => Promise<keyof typeof NETWORK>
    getBalance: () => Promise<string>
    getAddress: () => Promise<string>
    getChangeAddress: () => Promise<string>
    getRewardAddress: () => Promise<string>
    getRewardAddresses: () => Promise<string>
    getUtxos: () => Promise<string[]>
    signTx: (arg: string) => Promise<string>
    submitTx: (arg: string) => Promise<string>
    paymentTransaction: ({}) => Promise<any>
    delegationTransaction: ({}) => Promise<any>
    signData: (a: any, b?: any) => Promise<any>
}

class Extension {
    type: string
    cardano: Cardano

    constructor(type: string, cardano: Cardano) {
        this.type = type
        this.cardano = cardano
    }

    getNetwork = async () => {
        let id = await this.cardano.getNetworkId()

        return NETWORK[id]
    }

    getBalance = async () => {
        const balance = await this.cardano.getBalance()
        const CSLModule = await CSL.load()
        const BufferModule = await Buffer.load()

        return CSLModule.Value.from_bytes(BufferModule.from(balance, 'hex')).coin().to_str()
    }

    getChangeAddress = async () => {
        const changeAddress = await this.cardano.getChangeAddress()

        return await hexToBech32(changeAddress)
    }

    getRewardAddress = async () => {
        const rewardAddress = await this.cardano.getRewardAddresses()

        return await hexToBech32(rewardAddress[0])
    }

    getUtxos = async () => {
        const rawUtxos = await this.cardano.getUtxos()
        const CSLModule = await CSL.load()
        const BufferModule = await Buffer.load()

        return rawUtxos.map((utxo) => CSLModule.TransactionUnspentOutput.from_bytes(BufferModule.from(utxo, 'hex')))
    }

    getStakeKeyHash = async () => {
        const rewardAddress = await this.getRewardAddress()
        const CSLModule = await CSL.load()

        return CSLModule.RewardAddress.from_address(CSLModule.Address.from_bech32(rewardAddress))
            ?.payment_cred()
            ?.to_keyhash()
            ?.to_bytes()!
    }

    signData = async (message: string) => {
        const data = hexEncode(message)
        const api = this.cardano

        return api.signData(await api.getChangeAddress(), data)
    }

    signAndSubmit = async (transaction: CSLType.Transaction) => {
        try {
            const BufferModule = await Buffer.load()
            const CSLModule = await CSL.load()
            const txBytes = BufferModule.from(transaction.to_bytes())
            const witnesses = await this.cardano.signTx(txBytes.toString('hex'))
            const signedTx = CSLModule.Transaction.new(
                transaction.body(),
                CSLModule.TransactionWitnessSet.from_bytes(BufferModule.from(witnesses, 'hex'))
            )

            let signedBytes = BufferModule.from(signedTx.to_bytes())
            return await this.cardano.submitTx(signedBytes.toString('hex'))
        } catch (error: any) {
            throw error.info
        }
    }

    payTo = async (address: string, amount: string, protocolParameters: ProtocolParameters) => {
        try {
            const changeAddress = await this.getChangeAddress()
            const utxos = await this.getUtxos()
            const outputs = await prepareTx([{ address, amount }])
            const transaction = await buildTx(changeAddress, utxos, outputs, protocolParameters)

            return await this.signAndSubmit(transaction)
        } catch (error) {
            throw error
        }
    }

    multiSend = async (
        outputData: OutputData,
        protocolParameters: ProtocolParameters
    ) => {
        try {
            const changeAddress = await this.getChangeAddress()
            const utxos = await this.getUtxos()
            const txOutputs = await prepareTx(outputData)
            const transaction = await buildTx(changeAddress, utxos, txOutputs, protocolParameters)

            return await this.signAndSubmit(transaction)
        } catch (error) {
            throw error
        }
    }

    delegateTo = async (
        poolId: string,
        protocolParameters: ProtocolParameters,
        accountInformation: AccountInformation
    ) => {
        try {
            const changeAddress = await this.getChangeAddress()
            const utxos = await this.getUtxos()
            const outputs = await prepareTx([{ address: changeAddress, amount: protocolParameters.keyDeposit }])
            const stakeKeyHash = await this.getStakeKeyHash()
            const CSLModule = await CSL.load()
            const BufferModule = await Buffer.load()
            const certificates = CSLModule.Certificates.new()

            if (!accountInformation.active) {
                certificates.add(
                    CSLModule.Certificate.new_stake_registration(
                        CSLModule.StakeRegistration.new(
                            CSLModule.Credential.from_keyhash(
                                CSLModule.Ed25519KeyHash.from_bytes(BufferModule.from(stakeKeyHash))
                            )
                        )
                    )
                )
            }

            certificates.add(
                CSLModule.Certificate.new_stake_delegation(
                    CSLModule.StakeDelegation.new(
                        CSLModule.Credential.from_keyhash(
                            CSLModule.Ed25519KeyHash.from_bytes(BufferModule.from(stakeKeyHash))
                        ),
                        CSLModule.Ed25519KeyHash.from_bytes(BufferModule.from(poolId, 'hex'))
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
