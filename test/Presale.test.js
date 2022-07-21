const BN = require('bn.js')
const { toBN, toWei } = require('web3-utils')

const Token = artifacts.require('DeflationaryToken')
const Presale = artifacts.require('Presale')
const PairLP = artifacts.require('IUniswapV2Pair')
const Locker = artifacts.require('Locker')

require('chai').use(require('chai-bn')(BN)).should()

const sleep = (ms) => {
    return new Promise((resolve) => setTimeout(resolve, ms))
}

contract('Presale', async (accounts) => {
    const dev = accounts[0]
    const stranger1 = accounts[1]
    const stranger2 = accounts[2]

    const routerAddress = '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D'

    let presale
    const name = 'DeflationaryToken'
    const symbol = 'DFT'
    const decimals = toBN('18')
    const presaleInfo = 'Token presale'

    beforeEach(async () => {
        await Token.new()
        token = await Token.deployed()

        await Presale.new(token.address)
        presale = await Presale.at(newContract.address)
    })

    describe('initial presale data and token deploy', async () => {
        it('presale should be inactive', async () => {
            const _isActive = await presale.isActive()
            _isActive.should.be.false
        })

        it('Token gets deployed correctly', async () => {
            const _name = await token.name()
            const _symbol = await token.symbol()
            const _decimals = await token.decimals()
            const _supply = await token.totalSupply()
            const _taxFeePercent = await token._taxFee()
            const _charityFeePercent = await token._charityFee()
            const _router = await token.uniswapV2Router()

            _name.should.equal(name)
            _symbol.should.equal(symbol)
            _decimals.should.be.bignumber.equal(decimals)
            _supply.should.be.bignumber.equal(toWei('8100000000'))
            _taxFeePercent.should.be.bignumber.equal(toBN('0'))
            _charityFeePercent.should.be.bignumber.equal(toBN('0'))
            _router.should.equal(routerAddress)
        })
    })

    describe('Presale contract methods: starting presale', async () => {
        it('stranger cannot start presale', async () => {
            await presale
                .startPresale(
                    toWei('100', 'ether'),
                    toWei('3600', 'ether'),
                    toWei('35600', 'ether'),
                    toWei('1008000', 'ether'),
                    1125,
                    0,
                    presaleInfo,
                    dev,
                    {
                        from: stranger1,
                    },
                )
                .catch(async (error) => {
                    if (error.message.indexOf('Ownable: caller is not the owner') == -1) {
                        assert.fail(error.message)
                    } else assert.equal(1, 1)
                })
        })

        it('start presale from dev account', async () => {
            await presale.startPresale(
                toWei('100', 'ether'),
                toWei('3600', 'ether'),
                toWei('35600', 'ether'),
                toWei('1008000', 'ether'),
                1125,
                0,
                presaleInfo,
                dev,
                {
                    from: dev,
                },
            )

            const _minInvestment = await presale.minInvestment()
            const _maxInvestment = await presale.maxInvestment()
            const _maxInvestmentTotal = await presale.maxInvestmentTotal()
            const _cap = await presale.cap()
            const _rate = await presale.saleRate()
            const _isActive = await presale.isActive()

            _minInvestment.should.be.bignumber.equal(toWei('100', 'ether'))
            _maxInvestment.should.be.bignumber.equal(toWei('3600', 'ether'))
            _maxInvestmentTotal.should.be.bignumber.equal(toWei('35600', 'ether'))
            _cap.should.be.bignumber.equal(toWei('1008000'))
            _rate.should.be.bignumber.equal(toBN(1125))
            _isActive.should.equal(true)
        })
    })

    describe('Presale contract methods: buying tokens', async () => {
        it('dont allow buying tokens when less than minimum', async () => {
            await presale.startPresale(
                toWei('100', 'ether'),
                toWei('3600', 'ether'),
                toWei('35600', 'ether'),
                toWei('1008000', 'ether'),
                1125,
                0,
                presaleInfo,
                dev,
                {
                    from: dev,
                },
            )

            await presale
                .send(toWei('1', 'ether'), {
                    from: stranger1,
                })
                .catch(async (error) => {
                    if (error.message.indexOf('< minInvestment') == -1) {
                        assert.fail(error.message)
                    } else assert.equal(1, 1)
                })
        })

        it('dont allow buying tokens when more than maximum', async () => {
            await presale.startPresale(
                toWei('1', 'ether'),
                toWei('3', 'ether'),
                toWei('3', 'ether'),
                toWei('10', 'ether'),
                10,
                0,
                presaleInfo,
                dev,
                {
                    from: dev,
                },
            )

            await presale
                .send(toWei('3.1', 'ether'), {
                    from: stranger1,
                })
                .catch(async (error) => {
                    if (error.message.indexOf('> maxInvestment') == -1) {
                        assert.fail(error.message)
                    } else assert.equal(1, 1)
                })
        })

        it('dont allow buying tokens when total bought would be greater than maximum', async () => {
            await presale.startPresale(
                toWei('0.1', 'ether'),
                toWei('10', 'ether'),
                toWei('10', 'ether'),
                toWei('50', 'ether'),
                100,
                0,
                presaleInfo,
                dev,
                {
                    from: dev,
                },
            )

            await presale.send(toWei('10', 'ether'), {
                from: stranger1,
            })

            const _strangerBalance = await tokenContract.balanceOf(stranger1)
            const _contractBalance = await tokenContract.balanceOf(presale.address)

            _strangerBalance.should.be.bignumber.equal(toWei('1000', 'ether'))
            _contractBalance.should.be.bignumber.equal(toWei('8099999000', 'ether'))

            await presale
                .send(toWei('1'), {
                    from: stranger1,
                })
                .catch(async (error) => {
                    if (error.message.indexOf('Limit of maxInvestmentTotal') == -1) {
                        assert.fail(error.message)
                    } else assert.equal(1, 1)
                })
        })

        it('dont allow buying tokens when cap reached', async () => {
            await presale.startPresale(
                toWei('1', 'ether'),
                toWei('10', 'ether'),
                toWei('10', 'ether'),
                toWei('10', 'ether'),
                100,
                0,
                presaleInfo,
                dev,
                {
                    from: dev,
                },
            )

            await presale.send(toWei('10', 'ether'), {
                from: stranger1,
            })

            const _strangerBalance = await tokenContract.balanceOf(stranger1)
            const _contractBalance = await tokenContract.balanceOf(presale.address)

            _strangerBalance.should.be.bignumber.equal(toWei('1000', 'ether'))
            _contractBalance.should.be.bignumber.equal(toWei('8099999000', 'ether'))

            await presale
                .send(toWei('1'), {
                    from: stranger1,
                })
                .catch(async (error) => {
                    if (error.message.indexOf('Presale is not active') == -1) {
                        assert.fail(error.message)
                    } else assert.equal(1, 1)
                })
        })

        it('send tokens to buyers at rate with no tax fee and store eth', async () => {
            await presale.startPresale(
                toWei('1', 'ether'),
                toWei('3', 'ether'),
                toWei('10', 'ether'),
                toWei('10', 'ether'),
                100,
                0,
                presaleInfo,
                dev,
                {
                    from: dev,
                },
            )

            await presale.send(toWei('3', 'ether'), {
                from: stranger1,
            })

            const _strangerBalance = await tokenContract.balanceOf(stranger1)
            const _contractBalance = await tokenContract.balanceOf(presale.address)

            _strangerBalance.should.be.bignumber.equal(toWei('300', 'ether'))
            _contractBalance.should.be.bignumber.equal(toWei('8099999700', 'ether'))

            await presale.send(toWei('3', 'ether'), {
                from: dev,
            })

            const _devBalance = await tokenContract.balanceOf(dev)
            const _strangerBalance2 = await tokenContract.balanceOf(stranger1)
            const _contractBalance2 = await tokenContract.balanceOf(presale.address)

            _devBalance.should.be.bignumber.equal(toWei('300', 'ether'))
            _strangerBalance2.should.be.bignumber.equal(toWei('300', 'ether'))
            _contractBalance2.should.be.bignumber.equal(toWei('8099999400', 'ether'))

            await presale.send(toWei('3', 'ether'), {
                from: stranger2,
            })

            const _devBalance3 = await tokenContract.balanceOf(dev)
            const _strangerBalance3 = await tokenContract.balanceOf(stranger1)
            const _stranger2Balance3 = await tokenContract.balanceOf(stranger2)
            const _contractBalance3 = await tokenContract.balanceOf(presale.address)

            _devBalance3.should.be.bignumber.equal(toWei('300', 'ether'))
            _strangerBalance3.should.be.bignumber.equal(toWei('300', 'ether'))
            _stranger2Balance3.should.be.bignumber.equal(toWei('300', 'ether'))
            _contractBalance3.should.be.bignumber.equal(toWei('8099999100', 'ether'))
        })
    })

    describe('Presale contract methods: ending presale', async () => {
        it('ending presale and adding liquidity to pool', async () => {
            await presale.startPresale(
                toWei('0.1', 'ether'),
                toWei('10', 'ether'),
                toWei('30', 'ether'),
                toWei('50', 'ether'),
                100,
                0,
                presaleInfo,
                dev,
                {
                    from: dev,
                },
            )

            await presale.send(toWei('0.5', 'ether'), {
                from: stranger1,
            })

            await presale.endPresale({ from: dev })

            const _isActive = await presale.isActive()
            const _isEnded = await presale._isEnded()
            const _saleRate = await presale.saleRate()
            const _poolRate = await presale.poolRate()
            let _isPool = await presale._isPool()
            _saleRate.should.be.bignumber.gt(_poolRate)
            _isActive.should.be.false
            _isEnded.should.be.true
            _isPool.should.be.false

            await presale.addLiquidityToPool({ from: dev })

            _isPool = await presale._isPool()
            _isPool.should.be.true

            let _presaleContractBalanceEth = await web3.eth.getBalance(presale.address)
            _presaleContractBalanceEth.should.be.bignumber.gt(toBN(0))

            await presale.withdrawDevEth({ from: dev })

            _presaleContractBalanceEth = await web3.eth.getBalance(presale.address)
            _presaleContractBalanceEth.should.be.bignumber.equal(toBN(0))

            await presale.setFees(2, 1, { from: dev })

            const _taxFeePercent = await tokenContract._taxFee()
            const _charityFeePercent = await tokenContract._charityFee()
            _taxFeePercent.should.be.bignumber.equal(toBN('2'))
            _charityFeePercent.should.be.bignumber.equal(toBN('1'))
        })

        it('withdraw Liquidity Provider tokens from pool and sending them to owner', async () => {
            await presale.startPresale(
                toWei('0.1', 'ether'),
                toWei('10', 'ether'),
                toWei('30', 'ether'),
                toWei('50', 'ether'),
                100,
                0,
                presaleInfo,
                dev,
                {
                    from: dev,
                },
            )

            await presale.send(toWei('0.5', 'ether'), {
                from: stranger1,
            })

            await presale.endPresale({ from: dev })

            const _isActive = await presale.isActive()
            const _isEnded = await presale._isEnded()
            const _saleRate = await presale.saleRate()
            const _poolRate = await presale.poolRate()
            let _isPool = await presale._isPool()
            _saleRate.should.be.bignumber.gt(_poolRate)
            _isActive.should.be.false
            _isEnded.should.be.true
            _isPool.should.be.false

            await presale.addLiquidityToPool({ from: dev })

            _isPool = await presale._isPool()
            _isPool.should.be.true

            let _presaleContractBalanceEth = await web3.eth.getBalance(presale.address)
            _presaleContractBalanceEth.should.be.bignumber.gt(toBN(0))

            let _devBalanceEthBefore = await web3.eth.getBalance(dev)

            await presale.withdrawDevEth({ from: dev })

            let _devBalanceEthAfter = await web3.eth.getBalance(dev)
            _devBalanceEthAfter.should.be.bignumber.gt(_devBalanceEthBefore)

            _presaleContractBalanceEth = await web3.eth.getBalance(presale.address)
            _presaleContractBalanceEth.should.be.bignumber.equal(toBN(0))

            await presale.setFees(2, 1, { from: dev })

            const _taxFeePercent = await tokenContract._taxFee()
            const _charityFeePercent = await tokenContract._charityFee()
            _taxFeePercent.should.be.bignumber.equal(toBN('2'))
            _charityFeePercent.should.be.bignumber.equal(toBN('1'))

            const lpTokenAddress = await tokenContract.uniswapV2Pair()
            const lpToken = await PairLP.at(lpTokenAddress)

            await presale.withdrawLiquidity()

            const _devBalanceLp = await lpToken.balanceOf(dev)
            _devBalanceLp.should.be.bignumber.gt(toBN('0'))

            await presale.withdrawTokens()

            const _devBalanceTokens = await tokenContract.balanceOf(dev)
            _devBalanceTokens.should.be.bignumber.gt(toBN('0'))
        })

        it('owner lock liquidity and charity tokens in Locker contract', async () => {
            await presale.startPresale(
                toWei('0.1', 'ether'),
                toWei('10', 'ether'),
                toWei('30', 'ether'),
                toWei('50', 'ether'),
                100,
                0,
                presaleInfo,
                dev,
                {
                    from: dev,
                },
            )

            await presale.send(toWei('0.5', 'ether'), {
                from: stranger1,
            })

            await presale.endPresale({ from: dev })

            const _isActive = await presale.isActive()
            const _isEnded = await presale._isEnded()
            const _saleRate = await presale.saleRate()
            const _poolRate = await presale.poolRate()
            let _isPool = await presale._isPool()
            _saleRate.should.be.bignumber.gt(_poolRate)
            _isActive.should.be.false
            _isEnded.should.be.true
            _isPool.should.be.false

            await presale.addLiquidityToPool({ from: dev })

            _isPool = await presale._isPool()
            _isPool.should.be.true

            let _presaleContractBalanceEth = await web3.eth.getBalance(presale.address)
            _presaleContractBalanceEth.should.be.bignumber.gt(toBN(0))

            let _devBalanceEthBefore = await web3.eth.getBalance(dev)

            await presale.withdrawDevEth({ from: dev })

            let _devBalanceEthAfter = await web3.eth.getBalance(dev)
            _devBalanceEthAfter.should.be.bignumber.gt(_devBalanceEthBefore)

            _presaleContractBalanceEth = await web3.eth.getBalance(presale.address)
            _presaleContractBalanceEth.should.be.bignumber.equal(toBN(0))

            await presale.setFees(2, 1, { from: dev })

            const _taxFeePercent = await tokenContract._taxFee()
            const _charityFeePercent = await tokenContract._charityFee()
            _taxFeePercent.should.be.bignumber.equal(toBN('2'))
            _charityFeePercent.should.be.bignumber.equal(toBN('1'))

            const lpTokenAddress = await tokenContract.uniswapV2Pair()
            const lpToken = await PairLP.at(lpTokenAddress)

            await presale.withdrawLiquidity()

            const _devBalanceLp = await lpToken.balanceOf(dev)
            _devBalanceLp.should.be.bignumber.gt(toBN('0'))

            await presale.withdrawTokens()

            const _devBalanceTokens = await tokenContract.balanceOf(dev)
            _devBalanceTokens.should.be.bignumber.gt(toBN('0'))

            const lockerContract = await Locker.new()

            await tokenContract.approve(lockerContract.address, toWei('405000000'))
            await lpToken.approve(lockerContract.address, _devBalanceLp)

            const time = Math.ceil(Date.now() / 1000 + 600)

            const _withdrawalAddresses = [dev, dev, dev, dev]
            const _amounts = [toWei('162000000'), toWei('81000000'), toWei('81000000'), toWei('81000000')]
            const _unlockTimes = [time, time, time, time]

            await lockerContract.lockTokenMultiple(
                tokenContract.address,
                _amounts,
                _withdrawalAddresses,
                _unlockTimes,
                { from: dev },
            )

            await lockerContract.lockTokens(lpToken.address, _devBalanceLp, dev, time, {
                from: dev,
            })

            const _totalCharityTokenBalance = await lockerContract.getTotalTokenBalance(tokenContract.address)
            const _totalLpTokenBalance = await lockerContract.getTotalTokenBalance(lpToken.address)

            _totalCharityTokenBalance.should.be.bignumber.gt(toWei('397000000'))
            _totalLpTokenBalance.should.be.bignumber.equal(_devBalanceLp)
        })

        it("don't allow to withdraw tokens before deposit unlock time", async () => {
            await presale.startPresale(
                toWei('0.1', 'ether'),
                toWei('10', 'ether'),
                toWei('30', 'ether'),
                toWei('50', 'ether'),
                100,
                0,
                presaleInfo,
                dev,
                {
                    from: dev,
                },
            )

            await presale.send(toWei('0.5', 'ether'), {
                from: stranger1,
            })

            await presale.endPresale({ from: dev })

            const _isActive = await presale.isActive()
            const _isEnded = await presale._isEnded()
            const _saleRate = await presale.saleRate()
            const _poolRate = await presale.poolRate()
            let _isPool = await presale._isPool()
            _saleRate.should.be.bignumber.gt(_poolRate)
            _isActive.should.be.false
            _isEnded.should.be.true
            _isPool.should.be.false

            await presale.addLiquidityToPool({ from: dev })

            _isPool = await presale._isPool()
            _isPool.should.be.true

            let _presaleContractBalanceEth = await web3.eth.getBalance(presale.address)
            _presaleContractBalanceEth.should.be.bignumber.gt(toBN(0))

            let _devBalanceEthBefore = await web3.eth.getBalance(dev)

            await presale.withdrawDevEth({ from: dev })

            let _devBalanceEthAfter = await web3.eth.getBalance(dev)
            _devBalanceEthAfter.should.be.bignumber.gt(_devBalanceEthBefore)

            _presaleContractBalanceEth = await web3.eth.getBalance(presale.address)
            _presaleContractBalanceEth.should.be.bignumber.equal(toBN(0))

            await presale.setFees(2, 1, { from: dev })

            const _taxFeePercent = await tokenContract._taxFee()
            const _charityFeePercent = await tokenContract._charityFee()
            _taxFeePercent.should.be.bignumber.equal(toBN('2'))
            _charityFeePercent.should.be.bignumber.equal(toBN('1'))

            const lpTokenAddress = await tokenContract.uniswapV2Pair()
            const lpToken = await PairLP.at(lpTokenAddress)

            await presale.withdrawLiquidity()

            const _devBalanceLp = await lpToken.balanceOf(dev)
            _devBalanceLp.should.be.bignumber.gt(toBN('0'))

            await presale.withdrawTokens()

            const _devBalanceTokens = await tokenContract.balanceOf(dev)
            _devBalanceTokens.should.be.bignumber.gt(toBN('0'))

            const lockerContract = await Locker.new()

            await tokenContract.approve(lockerContract.address, toWei('405000000'))
            await lpToken.approve(lockerContract.address, _devBalanceLp)

            const time = Math.ceil(Date.now() / 1000 + 600)

            const _withdrawalAddresses = [dev, dev, dev, dev]
            const _amounts = [toWei('162000000'), toWei('81000000'), toWei('81000000'), toWei('81000000')]
            const _unlockTimes = [time, time, time, time]

            await lockerContract.lockTokenMultiple(
                tokenContract.address,
                _amounts,
                _withdrawalAddresses,
                _unlockTimes,
                { from: dev },
            )

            await lockerContract.lockTokens(lpToken.address, _devBalanceLp, dev, time, {
                from: dev,
            })

            const _totalCharityTokenBalance = await lockerContract.getTotalTokenBalance(tokenContract.address)
            const _totalLpTokenBalance = await lockerContract.getTotalTokenBalance(lpToken.address)

            _totalCharityTokenBalance.should.be.bignumber.gt(toWei('397000000'))
            _totalLpTokenBalance.should.be.bignumber.equal(_devBalanceLp)

            const _allDeposits = await lockerContract.getAllDepositIds()

            for (const i in _allDeposits) {
                await lockerContract.withdrawDeposit(_allDeposits[i]).catch(async (error) => {
                    if (error.message.indexOf('Tokens are locked') == -1) {
                        assert.fail(error.message)
                    } else assert.equal(1, 1)
                })
            }
        })

        it('withdraw tokens from Locker contract after unlock time pass', async () => {
            await presale.startPresale(
                toWei('0.1', 'ether'),
                toWei('10', 'ether'),
                toWei('30', 'ether'),
                toWei('50', 'ether'),
                100,
                0,
                presaleInfo,
                dev,
                { from: dev },
            )

            await presale.send(toWei('0.5', 'ether'), { from: stranger1 })

            await presale.endPresale({ from: dev })

            const _isActive = await presale.isActive()
            const _isEnded = await presale._isEnded()
            const _saleRate = await presale.saleRate()
            const _poolRate = await presale.poolRate()
            let _isPool = await presale._isPool()
            _saleRate.should.be.bignumber.gt(_poolRate)
            _isActive.should.be.false
            _isEnded.should.be.true
            _isPool.should.be.false

            await presale.addLiquidityToPool({ from: dev })

            _isPool = await presale._isPool()
            _isPool.should.be.true

            let _presaleContractBalanceEth = await web3.eth.getBalance(presale.address)
            _presaleContractBalanceEth.should.be.bignumber.gt(toBN(0))

            const _devBalanceEthBefore = await web3.eth.getBalance(dev)

            await presale.withdrawDevEth({ from: dev })

            const _devBalanceEthAfter = await web3.eth.getBalance(dev)
            _devBalanceEthAfter.should.be.bignumber.gt(_devBalanceEthBefore)

            _presaleContractBalanceEth = await web3.eth.getBalance(presale.address)
            _presaleContractBalanceEth.should.be.bignumber.equal(toBN(0))

            await presale.setFees(2, 1, { from: dev })

            const _taxFeePercent = await tokenContract._taxFee()
            const _charityFeePercent = await tokenContract._charityFee()
            _taxFeePercent.should.be.bignumber.equal(toBN('2'))
            _charityFeePercent.should.be.bignumber.equal(toBN('1'))

            const lpTokenAddress = await tokenContract.uniswapV2Pair()
            const lpToken = await PairLP.at(lpTokenAddress)

            await presale.withdrawLiquidity()

            const _devBalanceLp = await lpToken.balanceOf(dev)
            _devBalanceLp.should.be.bignumber.gt(toBN('0'))

            await presale.withdrawTokens()

            const _devBalanceTokens = await tokenContract.balanceOf(dev)
            _devBalanceTokens.should.be.bignumber.gt(toBN('0'))

            const lockerContract = await Locker.new()

            await tokenContract.approve(lockerContract.address, toWei('405000000'))
            await lpToken.approve(lockerContract.address, _devBalanceLp)

            const time = Math.round(Date.now() / 1000 + 60)

            const _withdrawalAddresses = [dev, dev, dev, dev]
            const _amounts = [toWei('162000000'), toWei('81000000'), toWei('81000000'), toWei('81000000')]
            const _unlockTimes = [time, time, time, time]

            await lockerContract.lockTokenMultiple(
                tokenContract.address,
                _amounts,
                _withdrawalAddresses,
                _unlockTimes,
                { from: dev },
            )

            await lockerContract.lockTokens(lpToken.address, _devBalanceLp, dev, time, {
                from: dev,
            })

            let _totalCharityTokenBalance = await lockerContract.getTotalTokenBalance(tokenContract.address)
            let _totalLpTokenBalance = await lockerContract.getTotalTokenBalance(lpToken.address)

            _totalCharityTokenBalance.should.be.bignumber.gt(toWei('397000000'))
            _totalLpTokenBalance.should.be.bignumber.equal(_devBalanceLp)

            const _allDeposits = await lockerContract.getAllDepositIds()

            await sleep(70000)

            for (const i in _allDeposits) {
                await lockerContract.withdrawDeposit(_allDeposits[i], { from: dev }).catch(async (error) => {
                    await lockerContract.emergencyWithdrawTokens(_allDeposits[i], dev, { from: dev })
                })
            }

            _totalCharityTokenBalance = await lockerContract.getTotalTokenBalance(tokenContract.address)
            _totalLpTokenBalance = await lockerContract.getTotalTokenBalance(lpToken.address)

            _totalCharityTokenBalance.should.be.bignumber.equal(toBN('0'))
            _totalLpTokenBalance.should.be.bignumber.equal(toBN('0'))
        })
    })
})
