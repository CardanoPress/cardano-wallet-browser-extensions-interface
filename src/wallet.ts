import { OutputData, ProtocolParameters, TX } from './config'
import CSL, { CSLType } from './csl'

export const prepareTx = async (outputData?: OutputData, utxos?: CSLType.TransactionUnspentOutput[]) => {
    const CSLModule = await CSL.load()
    const inputs = CSLModule.TransactionUnspentOutputs.new()
    const outputs = CSLModule.TransactionOutputs.new()

    if (utxos) {
        utxos.forEach((u) => inputs.add(u))
    }

    if (outputData) {
        outputData.forEach((output) => {
            outputs.add(
                CSLModule.TransactionOutput.new(
                    CSLModule.Address.from_bech32(output.address),
                    CSLModule.Value.new(CSLModule.BigNum.from_str(output.amount))
                )
            )
        })
    }

    return { inputs, outputs }
}

export const buildTx = async (
    changeAddress: string,
    inputs: CSLType.TransactionUnspentOutputs,
    outputs: CSLType.TransactionOutputs,
    protocolParameters: ProtocolParameters,
    certificates: CSLType.Certificates | null = null
) => {
    const CSLModule = await CSL.load()
    const txBuilderConfig = CSLModule.TransactionBuilderConfigBuilder.new()
        .fee_algo(
            CSLModule.LinearFee.new(
                CSLModule.BigNum.from_str(protocolParameters.minFeeA.toString()),
                CSLModule.BigNum.from_str(protocolParameters.minFeeB.toString())
            )
        )
        .coins_per_utxo_byte(CSLModule.BigNum.from_str(protocolParameters.coinsPerUtxoSize))
        .pool_deposit(CSLModule.BigNum.from_str(protocolParameters.poolDeposit))
        .key_deposit(CSLModule.BigNum.from_str(protocolParameters.keyDeposit))
        .max_value_size(protocolParameters.maxValSize)
        .max_tx_size(protocolParameters.maxTxSize)
        .prefer_pure_change(true)

    const txBuilder = CSLModule.TransactionBuilder.new(txBuilderConfig.build())

    if (certificates) {
        txBuilder.set_certs(certificates)
    }

    for (let i = 0; i < outputs.len(); i++) {
        txBuilder.add_output(outputs.get(i))
    }

    txBuilder.set_ttl(protocolParameters.slot + TX.invalid_hereafter)
    txBuilder.add_inputs_from(inputs, CSLModule.CoinSelectionStrategyCIP2.RandomImproveMultiAsset)
    txBuilder.add_change_if_needed(CSLModule.Address.from_bech32(changeAddress))

    const transaction = CSLModule.Transaction.new(txBuilder.build(), CSLModule.TransactionWitnessSet.new())

    const size = transaction.to_bytes().length * 2
    if (size > protocolParameters.maxTxSize) throw TX.too_big

    return transaction
}
