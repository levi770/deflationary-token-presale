require('dotenv').config()
const web3 = require('web3')
const u = require('web3-utils')
const provider = new web3.providers.HttpProvider(process.env['ROPSTEN_HOST'])
const w3 = new web3(provider)
const presaleJson = require('./contracts/Presale.json')
const tokenJson = require('./contracts/CharityToken.json')
const presaleAddress = process.env['PRESALE_ADDRESS']
const presaleContract = new w3.eth.Contract(presaleJson.abi, presaleAddress)

const userAddress = process.env['USER_ADDRESS']
const userPrivKey = process.env['USER_PRIV_KEY']

const run = async () => {
    const isActive = await presaleContract.methods.isActive().call()
    console.log('presale is active: ' + isActive)

    const tokenAddress = await presaleContract.methods.charityToken().call()
    const tokenContract = new w3.eth.Contract(tokenJson.abi, tokenAddress)

    const buyTx = await sendMaticToPresaleContract(userAddress, presaleAddress, userPrivKey, 1)
    console.log('transfered MATIC to presaleContract: ' + buyTx.status)

    const userTokenBalance = await tokenContract.methods.balanceOf(userAddress).call()
    console.log('user balance of ChartityToken: ' + u.fromWei(userTokenBalance, 'ether') + ' CHAT')

    const userEthBalance = await w3.eth.getBalance(userAddress)
    console.log('user balance of MATIC: ' + u.fromWei(userEthBalance, 'ether') + ' MATIC')
}

run()

const sendMaticToPresaleContract = async (from, to, key, amount) => {
    const transferAmount = u.toWei(amount.toString(), 'ether')

    const tx = {
        nonce: await w3.eth.getTransactionCount(from),
        chainId: await w3.eth.getChainId(),
        from: from,
        to: to,
        gas: await w3.eth.estimateGas({
            from: from,
            to: to,
            value: transferAmount,
        }),
        maxPriorityFeePerGas: await w3.eth.getGasPrice(),
        value: transferAmount,
    }

    const balance = await w3.eth.getBalance(from)
    const comission = +tx.gas * +tx.maxPriorityFeePerGas

    if (+balance < +transferAmount + comission) {
        throw new Error('Not enough ETH balance')
    }

    const signedTx = await w3.eth.accounts.signTransaction(tx, key)
    return await w3.eth.sendSignedTransaction(signedTx.rawTransaction)
}

// > charity_contracts@0.0.1 run
// > node ./scripts/plainJs/buyTokens.js

// presale is active: true
// transfered MATIC to presaleContract: true
// user balance of ChartityToken: 1000 CHAT
// user balance of MATIC: 0.99896636630989711 MATIC
