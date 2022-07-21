import React, { Component } from 'react'
import QRCode from 'react-qr-code'
import CharityToken from './contracts/CharityToken.json'
import Presale from './contracts/Presale.json'
import getWeb3 from './getWeb3'

import './App.css'

class App extends Component {
    state = {
        loaded: false,
        tokenSaleAddress: null,
        userTokens: 0,
        isActive: false,
        info: null,
        min: 0,
        max: 0,
        total: 0,
        rate: 0,
        cap: 0,
    }

    componentDidMount = async () => {
        try {
            // Get network provider and web3 instance.
            this.w3 = await getWeb3()

            const presale_address = '0xfDD2402fBf0EE6CEc69B8467FeED2b5F685C6739'

            // Use web3 to get the user's accounts.
            this.accounts = await this.w3.eth.getAccounts()

            // Get the contract instance.
            this.networkId = await this.w3.eth.net.getId()

            this.PresaleInstance = new this.w3.eth.Contract(Presale.abi, presale_address)

            const tokenAddress = await this.PresaleInstance.methods.charityToken().call()
            const isActive = await this.PresaleInstance.methods.isActive().call()
            const info = await this.PresaleInstance.methods.presaleInfo().call()
            const min = await this.PresaleInstance.methods.minInvestment().call()
            const max = await this.PresaleInstance.methods.maxInvestment().call()
            const total = await this.PresaleInstance.methods.maxInvestmentTotal().call()
            const rate = await this.PresaleInstance.methods.saleRate().call()
            const cap = await this.PresaleInstance.methods.cap().call()

            console.log(tokenAddress)

            this.TokenInstance = new this.w3.eth.Contract(CharityToken.abi, presale_address)

            // Set web3, accounts, and contract to the state, and then proceed with an
            // example of interacting with the contract's methods.
            this.listenToTokenTransfer()
            this.setState(
                {
                    loaded: true,
                    tokenSaleAddress: Presale.networks[this.networkId].address,
                    isActive,
                    info,
                    min,
                    max,
                    total,
                    rate,
                    cap,
                },
                this.updateUserTokens,
            )
        } catch (error) {
            // Catch any errors for any of the above operations.
            alert(`Failed to load web3, accounts, or contract. Check console for details.`)
            console.error(error)
        }
    }

    updateUserTokens = async () => {
        let userTokens = await this.TokenInstance.methods.balanceOf(this.accounts[0]).call()
        this.setState({ userTokens: userTokens })
    }

    listenToTokenTransfer = () => {
        this.TokenInstance.events.Transfer({ to: this.accounts[0] }).on('data', this.updateUserTokens)
    }

    handleMoreTokensPurchase = async () => {
        await this.w3.eth.sendTransaction({
            from: this.accounts[0],
            to: this.state.tokenSaleAddress,
            value: this.w3.utils.toWei('1', 'wei'),
        })
    }

    render() {
        if (!this.state.loaded) {
            return <div>Loading Web3, accounts, and contract...</div>
        }
        return (
            <div className="App">
                <h1>CharityToken PreSale</h1>
                <p>
                    To buy Charity Tokens just send some ETH to presale contract. After transaction received Presale
                    contract will automaticaly send Charity Tokens on your address. To buy Charity Tokens just send some
                    ETH to presale contract. After transaction received Presale contract will automaticaly send Charity
                    Tokens on your address.
                </p>
                <h2>Presale details:</h2>
                <ul>
                    <li>Presale info: {this.state.info}</li>
                    <li>Presale active: {this.state.isActive.toString()}</li>
                    <li>Hardcap: {this.state.cap / 10 ** 18}</li>
                    <li>Minimum investment: {this.state.min / 10 ** 18}</li>
                    <li>Maximum investment: {this.state.max / 10 ** 18}</li>
                    <li>Maximum total investment: {this.state.total / 10 ** 18}</li>
                    <li>Tokens per one ETH: {this.state.rate}</li>
                </ul>
                <h2>Buy Tokens</h2>
                <p>If you want to buy tokens, send wei to this address: {this.state.tokenSaleAddress} </p>
                <QRCode title="GeeksForGeeks" value={this.state.tokenSaleAddress} />
                <p>¥ou currently have {this.state.userTokens / 10 ** 18} CHAT</p>
                <button type="button" onClick={this.handleMoreTokensPurchase}>
                    Buy More Charity Tokens
                </button>
            </div>
        )
    }
}

export default App
