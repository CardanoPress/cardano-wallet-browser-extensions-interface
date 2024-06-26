import { ProtocolParameters, TX } from './config'
import CSL, { CSLType } from './csl'

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
    const CSLModule = await CSL.load()
    const outputs = CSLModule.TransactionOutputs.new()

    outputs.add(
        CSLModule.TransactionOutput.new(
            CSLModule.Address.from_bech32(paymentAddress),
            CSLModule.Value.new(CSLModule.BigNum.from_str(lovelaceValue))
        )
    )

    return outputs
}

export const buildTx = async (
    changeAddress: string,
    utxos: CSLType.TransactionUnspentOutput[],
    outputs: CSLType.TransactionOutputs,
    protocolParameters: ProtocolParameters,
    certificates: CSLType.Certificates | null = null
) => {
    const totalAssets = await multiAssetCount(outputs.get(0).amount().multiasset()!)
    const { default: CoinSelection } = await import('./lib/coinSelection')

    CoinSelection.setProtocolParameters(
        protocolParameters.minUtxo,
        protocolParameters.minFeeA.toString(),
        protocolParameters.minFeeB.toString(),
        protocolParameters.maxTxSize.toString()
    )

    let selection: {
        input: CSLType.TransactionUnspentOutput[]
        output: CSLType.TransactionOutput[]
        remaining: CSLType.TransactionUnspentOutput[]
        amount: CSLType.Value
        change: CSLType.Value
    }

    try {
        selection = await CoinSelection.randomImprove(utxos, outputs, 20 + totalAssets)
    } catch {
        throw TX.not_possible
    }

    const inputs = selection.input
    const CSLModule = await CSL.load()
    const txBuilder = CSLModule.TransactionBuilder.new(
        CSLModule.LinearFee.new(
            CSLModule.BigNum.from_str(protocolParameters.minFeeA.toString()),
            CSLModule.BigNum.from_str(protocolParameters.minFeeB.toString())
        ),
        CSLModule.BigNum.from_str(protocolParameters.minUtxo),
        CSLModule.BigNum.from_str(protocolParameters.poolDeposit),
        CSLModule.BigNum.from_str(protocolParameters.keyDeposit),
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

    for (let i = 0; i < outputs.len(); i++) {
        txBuilder.add_output(outputs.get(i))
    }

    const change = selection.change
    const changeMultiAssets = change.multiasset()

    // check if change value is too big for single output
    if (changeMultiAssets && change.to_bytes().length * 2 > protocolParameters.maxValSize) {
        const partialChange = CSLModule.Value.new(CSLModule.BigNum.from_str('0'))

        const partialMultiAssets = CSLModule.MultiAsset.new()
        const policies = changeMultiAssets.keys()
        const makeSplit = () => {
            for (let j = 0; j < changeMultiAssets.len(); j++) {
                const policy = policies.get(j)
                const policyAssets = changeMultiAssets.get(policy)!
                const assetNames = policyAssets.keys()
                const assets = CSLModule.Assets.new()
                for (let k = 0; k < assetNames.len(); k++) {
                    const policyAsset = assetNames.get(k)
                    const quantity = policyAssets.get(policyAsset)!
                    assets.insert(policyAsset, quantity)
                    //check size
                    const checkMultiAssets = CSLModule.MultiAsset.from_bytes(partialMultiAssets.to_bytes())
                    checkMultiAssets.insert(policy, assets)
                    const checkValue = CSLModule.Value.new(CSLModule.BigNum.from_str('0'))
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
        const minAda = CSLModule.min_ada_required(partialChange, CSLModule.BigNum.from_str(protocolParameters.minUtxo))
        partialChange.set_coin(minAda)

        txBuilder.add_output(
            CSLModule.TransactionOutput.new(CSLModule.Address.from_bech32(changeAddress), partialChange)
        )
    }

    txBuilder.set_ttl(protocolParameters.slot + TX.invalid_hereafter)
    txBuilder.add_change_if_needed(CSLModule.Address.from_bech32(changeAddress))

    const transaction = CSLModule.Transaction.new(txBuilder.build(), CSLModule.TransactionWitnessSet.new())

    const size = transaction.to_bytes().length * 2
    if (size > protocolParameters.maxTxSize) throw TX.too_big

    return transaction
}
