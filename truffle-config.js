require('dotenv').config()
require('babel-register')
require('babel-polyfill')
/* eslint-disable camelcase */
const HDWalletProvider = require('@truffle/hdwallet-provider')

const MNEMONIC = process.env['MNEMONIC']
const MUMBAI_HOST = process.env['MUMBAI_HOST']
const MATIC_HOST = process.env['MATIC_HOST']
const POLYGONSCAN_KEY = process.env['POLYGONSCAN_KEY']

module.exports = {
    networks: {
        development: {
            host: '127.0.0.1',
            port: 8545,
            network_id: '*',
            chain_id: 1337,
        },

        ganache: {
            host: '127.0.0.1',
            port: 7545,
            network_id: '*',
            chain: { allowUnlimitedContractSize: true },
        },

        mumbai: {
            provider: () => {
                return new HDWalletProvider(MNEMONIC, MUMBAI_HOST)
            },
            network_id: 80001,
            confirmations: 2,
            skipDryRun: true,
        },

        matic: {
            provider: () => {
                return new HDWalletProvider(MNEMONIC, MATIC_HOST)
            },
            network_id: 137,
            confirmations: 2,
            skipDryRun: true,
        },
    },

    compilers: {
        solc: {
            version: '0.8.12',
            settings: {
                optimizer: {
                    enabled: true,
                    runs: 200,
                },
            },
        },
    },

    plugins: ['truffle-plugin-verify'],

    api_keys: {
        polygonscan: POLYGONSCAN_KEY,
    },
}
