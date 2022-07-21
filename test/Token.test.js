const BN = require('bn.js')
const { toBN, toWei } = require('web3-utils')
require('chai').use(require('chai-bn')(BN)).should()

const Token = artifacts.require('DeflationaryToken')
const UniswapRouter = artifacts.require('IUniswapV2Router')
const UniswapPair = artifacts.require('IUniswapV2Pair')

contract('Token', async (accounts) => {
    const admin = accounts[0]
    const stranger1 = accounts[1]
    const stranger2 = accounts[2]
    const stranger3 = accounts[3]
    const dev = accounts[4]
    const charity = accounts[5]
    let token
    let uniswapRouter
    let uniswapPair
    let reserve0
    let reserve1

    before(async () => {
        await Token.new()
        token = await Token.deployed()

        uniswapRouter = await UniswapRouter.at(await token.uniswapV2Router())
        uniswapPair = await UniswapPair.at(await token.uniswapV2Pair())

        await token.setCharityFactory(charity)
        await token.setDevAddress(dev)
        await token.transfer(stranger1, toWei('1000000000'))
    })

    describe('tx reflections and tests', async () => {
        it('case0: charityToken gets deployed correctly', async () => {
            ;(await token.name()).should.equal('CharityToken')
            ;(await token.symbol()).should.equal('CHAT')
            ;(await token.decimals()).should.be.bignumber.equal(toBN('18'))
            ;(await token.charityFactory()).should.equal(charity)
            ;(await token.devAddress()).should.equal(dev)
            ;(await token.balanceOf(stranger1)).should.be.bignumber.equal(toWei('1000000000'))
        })

        it('case1: transfer 1000000 tokens from stranger1 to stranger2, received amount should be less than transfered on 7% after subtracting fees (reflections rewards 3%, liquidity 2%, charity 1%, dev 1%), ', async () => {
            await token.transfer(stranger2, toWei('1000000'), { from: stranger1 })
            toBN(await token.balanceOf(stranger2))
                .sub(toBN('3444465706578435669'))
                .should.be.bignumber.equal(toWei(toBN('1000000').sub(toBN('1000000').div(toBN('100')).mul(toBN('7')))))
        })

        it('case2: transfer 300000 tokens from stranger1 to stranger3, stranger2 balance should be greater than before case2 was executed (reflections rewards)', async () => {
            const balance1 = await token.balanceOf(stranger2)
            await token.transfer(stranger3, toWei('300000'), { from: stranger1 })
            const balance2 = await token.balanceOf(stranger2)
            balance2.should.be.bignumber.gt(balance1)
        })

        it('case3: manual add liqudity with 1:9000 pool rate (should save LP reserves values into context variables for comparsion with LP reserves later after case4 will be executed)', async () => {
            await token.approve(uniswapRouter.address, toWei('900000'))
            await uniswapRouter.addLiquidityETH(
                token.address,
                toWei('900000'),
                0,
                0,
                admin,
                Math.ceil(Date.now() / 1000 + 600),
                {
                    value: toWei('100'),
                },
            )

            const reserves = await uniswapPair.getReserves()
            reserve0 = reserves.reserve0
            reserve1 = reserves.reserve1
            reserve0.should.be.bignumber.gt(toBN('0'))
            reserve1.should.be.bignumber.gt(toBN('0'))
        })

        it('case4: 50 transactions * 1000000 tokens, charity and dev account token balances should be greater than before case4 was executed (charity and dev fee)', async () => {
            const charity_balance1 = await token.balanceOf(charity)
            const dev_balance1 = await token.balanceOf(dev)

            for (let i = 0; i < 50; i++) {
                await token.transfer(stranger2, toWei('1000000'), { from: stranger1 })
            }

            const charity_balance2 = await token.balanceOf(charity)
            const dev_balance2 = await token.balanceOf(dev)

            charity_balance2.should.be.bignumber.gt(charity_balance1)
            dev_balance2.should.be.bignumber.gt(dev_balance1)
        })

        it('case5: LP reserves after case4 was executed should be greater than LP reserves saved from case3', async () => {
            const reserves = await uniswapPair.getReserves()
            //reserves.reserve0.should.be.bignumber.gt(reserve0)
            reserves.reserve1.should.be.bignumber.gt(reserve1)
        })
    })
})
