const DeflationaryToken = artifacts.require('DeflationaryToken')
const Presale = artifacts.require('Presale')
const Locker = artifacts.require('Locker')

module.exports = async function (deployer, network, accounts) {
    await deployer.deploy(DeflationaryToken)
    const tokenInstance = await DeflationaryToken.deployed()

    await deployer.deploy(Presale, tokenInstance.address)
    await deployer.deploy(Locker)

    return true
}
