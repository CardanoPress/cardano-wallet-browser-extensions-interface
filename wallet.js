import { TX } from './config'
import CoinSelection from './lib/coinSelection'
import * as CSL from '@emurgo/cardano-serialization-lib-browser'

/**
 * @param {CSL.MultiAsset} multiAsset
 * @returns
 */
const multiAssetCount = async (multiAsset) => {
    if (!multiAsset) return 0
    let count = 0
    const policies = multiAsset.keys()
    for (let j = 0; j < multiAsset.len(); j++) {
        const policy = policies.get(j)
        const policyAssets = multiAsset.get(policy)
        const assetNames = policyAssets.keys()
        for (let k = 0; k < assetNames.len(); k++) {
            count++
        }
    }
    return count
}

export const prepareTx = async (lovelaceValue, paymentAddress) => {
    const outputs = CSL.TransactionOutputs.new()

    outputs.add(
        CSL.TransactionOutput.new(
            CSL.Address.from_bech32(paymentAddress),
            CSL.Value.new(CSL.BigNum.from_str(lovelaceValue))
        )
    )

    return outputs
}

export const buildTx = async (changeAddress, utxos, outputs, protocolParameters, certificates = null) => {
    const txBuilderConfig = CSL.TransactionBuilderConfigBuilder.new()
        .fee_algo(
            CSL.LinearFee.new(
                CSL.BigNum.from_str(protocolParameters.minFeeA.toString()),
                CSL.BigNum.from_str(protocolParameters.minFeeB.toString())
            )
        )
        .coins_per_utxo_word(CSL.BigNum.from_str(protocolParameters.coinsPerUtxoWord))
        .pool_deposit(CSL.BigNum.from_str(protocolParameters.poolDeposit))
        .key_deposit(CSL.BigNum.from_str(protocolParameters.keyDeposit))
        .max_value_size(parseInt(protocolParameters.maxValSize))
        .max_tx_size(parseInt(protocolParameters.maxTxSize))
        .prefer_pure_change(true)

    const txBuilder = CSL.TransactionBuilder.new(txBuilderConfig.build());

    if (certificates) {
        txBuilder.set_certs(certificates)
    }

    const UTxOs= CSL.TransactionUnspentOutputs.new()

    utxos.forEach(u => UTxOs.add(u));

    txBuilder.add_inputs_from(UTxOs, CSL.CoinSelectionStrategyCIP2.RandomImprove);
    txBuilder.add_output(outputs.get(0))
    txBuilder.set_ttl(protocolParameters.slot + TX.invalid_hereafter)
    txBuilder.add_change_if_needed(CSL.Address.from_bech32(changeAddress))

    const transaction = CSL.Transaction.new(txBuilder.build(), CSL.TransactionWitnessSet.new())

    const size = transaction.to_bytes().length * 2
    if (size > protocolParameters.maxTxSize) throw TX.too_big

    return transaction
}
