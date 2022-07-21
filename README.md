# Deflationary DeFi token, IDO Presale contract and Token/Liquidity Locker contract

This repo holds Deflationary token contract, Presale contract, Locker contract and tests around it using Truffle.
Scripts folder holds example integrations: web.js based demo script and ReactJS based demo app.

## Deflationary token with tokenomics and Automated Liquidity Acquisition

-   Community distribution - x% of every CharityToken transaction is redistributed back to the holders using reflections mechanism
    explained in detail in [this article](https://reflect-contract-doc.netlify.app/)
-   Automatic liquidity distribution - x% 5% fee from swap and transfers can be kept in a standalone pool within the contract itself and automatically converted to the liquidity pool after the token count reaches a threshold, explained in detail in [this article](https://safemoon.com/whitepaper.pdf)
-   Charitable ecosystem donations and dev fees

## IDO Presale contract for token launch on DEX

Smart Contract for creating IDO liquidity pools, leveraging UniswapV2Pairs for specialized reward distribution based on derived token share from LP.

Pools have a start and end timestamps, along with minimum and maximum contribution amounts. Investors can contribute to IDO pools to receive future tokens based on a rate set in USDT, USDC, or alternatives. Funds collected are forwarded to a wallet as they arrive. More info on the intended functionality for pools and staking can be found in the gitbook documentation.

## Token Locker contract

Token/liquidity locker contract to maintain transparency in DeFi ecosystem.

Requirements: NodeJS, Truffle

To launch this demo:

1. clone this repository
2. run `npm i`
3. run `truffle compile`
4. run `truffle migrate`
5. run `truffle test`
