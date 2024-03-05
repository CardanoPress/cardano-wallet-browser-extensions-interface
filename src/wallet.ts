import { TX } from './config'
import CoinSelection from './lib/coinSelection'
import CSL from './csl'
import type CSLType from '@emurgo/cardano-serialization-lib-browser';

const multiAssetCount = async (multiAsset: CSLType.MultiAsset) => {
    if (!multiAsset) return 0
    let count = 0
    const policies = multiAsset.keys()
    for (let j = 0; j < multiAsset.len(); j++) {
        const policy = policies.get(j)
        const policyAssets = multiAsset.get(policy)
        const assetNames = policyAssets?.keys()!
        for (let k = 0; k < assetNames.len(); k++) {
            count++
        }
    }
    return count
}

export const prepareTx = async (lovelaceValue: string, paymentAddress: string) => {
    await CSL.load()
    const outputs = CSL.Module.TransactionOutputs.new()

    outputs.add(
        CSL.Module.TransactionOutput.new(
            CSL.Module.Address.from_bech32(paymentAddress),
            CSL.Module.Value.new(CSL.Module.BigNum.from_str(lovelaceValue))
        )
    )

    return outputs
}

export const buildTx = async (changeAddress: string, utxos: CSLType.TransactionUnspentOutput[], outputs: CSLType.TransactionOutputs, protocolParameters: any, certificates: CSLType.Certificates | null = null) => {
    const totalAssets = await multiAssetCount(outputs.get(0).amount().multiasset()!)
    CoinSelection.setProtocolParameters(
        protocolParameters.minUtxo,
        protocolParameters.minFeeA.toString(),
        protocolParameters.minFeeB.toString(),
        protocolParameters.maxTxSize.toString()
    )

    let selection: {
        input: CSLType.TransactionUnspentOutput[];
        output: CSLType.TransactionOutput[];
        remaining: CSLType.TransactionUnspentOutput[];
        amount: CSLType.Value;
        change: CSLType.Value;
    }

    try {
        selection = await CoinSelection.randomImprove(utxos, outputs, 20 + totalAssets)
    } catch {
        throw TX.not_possible
    }

    const inputs = selection.input

    await CSL.load()
    const txBuilder = CSL.Module.TransactionBuilder.new(
        CSL.Module.LinearFee.new(
            CSL.Module.BigNum.from_str(protocolParameters.minFeeA.toString()),
            CSL.Module.BigNum.from_str(protocolParameters.minFeeB.toString())
        ),
        CSL.Module.BigNum.from_str(protocolParameters.minUtxo),
        CSL.Module.BigNum.from_str(protocolParameters.poolDeposit),
        CSL.Module.BigNum.from_str(protocolParameters.keyDeposit),
        protocolParameters.maxValSize,
        protocolParameters.maxTxSize
    )

    if (certificates) {
        txBuilder.set_certs(certificates)
    }

    for (let i = 0; i < inputs.length; i++) {
        const utxo = inputs[i]
        txBuilder.add_input(utxo.output().address(), utxo.input(), utxo.output().amount())
    }

    txBuilder.add_output(outputs.get(0))

    const change = selection.change
    const changeMultiAssets = change.multiasset()

    // check if change value is too big for single output
    if (changeMultiAssets && change.to_bytes().length * 2 > protocolParameters.maxValSize) {
        const partialChange = CSL.Module.Value.new(CSL.Module.BigNum.from_str('0'))

        const partialMultiAssets = CSL.Module.MultiAsset.new()
        const policies = changeMultiAssets.keys()
        const makeSplit = () => {
            for (let j = 0; j < changeMultiAssets.len(); j++) {
                const policy = policies.get(j)
                const policyAssets = changeMultiAssets.get(policy)!
                const assetNames = policyAssets.keys()
                const assets = CSL.Module.Assets.new()
                for (let k = 0; k < assetNames.len(); k++) {
                    const policyAsset = assetNames.get(k)
                    const quantity = policyAssets.get(policyAsset)!
                    assets.insert(policyAsset, quantity)
                    //check size
                    const checkMultiAssets = CSL.Module.MultiAsset.from_bytes(partialMultiAssets.to_bytes())
                    checkMultiAssets.insert(policy, assets)
                    const checkValue = CSL.Module.Value.new(CSL.Module.BigNum.from_str('0'))
                    checkValue.set_multiasset(checkMultiAssets)
                    if (checkValue.to_bytes().length * 2 >= protocolParameters.maxValSize) {
                        partialMultiAssets.insert(policy, assets)
                        return
                    }
                }
                partialMultiAssets.insert(policy, assets)
            }
        }
        makeSplit()
        partialChange.set_multiasset(partialMultiAssets)
        const minAda = CSL.Module.min_ada_required(partialChange, CSL.Module.BigNum.from_str(protocolParameters.minUtxo))
        partialChange.set_coin(minAda)

        txBuilder.add_output(CSL.Module.TransactionOutput.new(CSL.Module.Address.from_bech32(changeAddress), partialChange))
    }

    txBuilder.set_ttl(protocolParameters.slot + TX.invalid_hereafter)
    txBuilder.add_change_if_needed(CSL.Module.Address.from_bech32(changeAddress))

    const transaction = CSL.Module.Transaction.new(txBuilder.build(), CSL.Module.TransactionWitnessSet.new())

    const size = transaction.to_bytes().length * 2
    if (size > protocolParameters.maxTxSize) throw TX.too_big

    return transaction
}
