// SPDX-License-Identifier: MIT

pragma solidity ^0.8.12;

import "./libraries/SafeMath.sol";
import "./libraries/Address.sol";
import "./contracts/Ownable.sol";
import "./interfaces/IUniswapV2Router.sol";
import "./interfaces/IUniswapV2Factory.sol";
import "./interfaces/IUniswapV2Pair.sol";
import "./DeflationaryToken.sol";

contract Presale is Ownable {
    using SafeMath for uint256;
    using Address for address;

    DeflationaryToken public token;
    IUniswapV2Router public uniswapV2Router;
    IUniswapV2Pair public uniswapV2Pair;
    address payable private devAddress;
    uint256 public cap;
    uint256 public minInvestment;
    uint256 public maxInvestment;
    uint256 public maxInvestmentTotal;
    uint256 public saleRate;
    uint256 public poolRate;
    uint256 public unlockLiquidity;
    uint256 private devEth = 0;
    uint256 private liquidityEth = 0;
    uint256 private liquidityTokens = 0;
    bool private _isActive = false;
    bool private _isEnded = false;
    bool private _isPool = false;
    bool private _isDev = false;
    bool private _isLocked = false;
    string public presaleInfo;
    mapping(address => uint256) public investors;

    event Deployed(address indexed from, address presale, address router, address charityToken);
    event Started(
        uint256 rate,
        uint256 minInvestment,
        uint256 maxInvestment,
        uint256 maxInvestmentTotal,
        uint256 cap,
        bool isActive,
        address indexed devAddress,
        string presaleInfo,
        uint256 unlockLiquidity
    );
    event Received(address indexed from, uint256 eth, uint256 tokens, uint256 total);
    event Ended(uint256 devEth, uint256 liquidityEth, uint256 liquidityTokens, uint256 saleRate, uint256 poolRate);
    event Aproved(bool result, address router, uint256 amount);
    event Pool(uint256 amountToken, uint256 amountETH, uint256 liquidity, address router);
    event WithdrawDev(uint256 amount);
    event WithdrawLiquidity(address pair, uint256 amount);
    event WithdrawTokens(uint256 amount);

    constructor(address payable _token) {
        token = DeflationaryToken(_token);
        uniswapV2Router = token.uniswapV2Router();
        uniswapV2Pair = IUniswapV2Pair(token.uniswapV2Pair());

        emit Deployed(_msgSender(), address(this), address(uniswapV2Router), address(token));
    }

    function isActive() public view returns (bool) {
        return _isActive == true && address(this).balance < cap;
    }

    function startPresale(
        uint256 min,
        uint256 max,
        uint256 total,
        uint256 hardCap,
        uint256 tokensPerEth,
        uint256 unlock,
        string memory info,
        address payable dev
    ) public onlyOwner {
        require(min > 0, "min must be > 0");
        require(max >= min, "max must be >= min");
        require(total >= max, "total must be >= max");
        require(hardCap > 0, "hardCap must be >= total");
        require(tokensPerEth > 0, "tokensPerEth must be > 0");
        require(dev != address(0), "dev address can not be 0");
        require(_isActive != true, "Presale already started");

        saleRate = tokensPerEth;
        minInvestment = min;
        maxInvestment = max;
        maxInvestmentTotal = total;
        cap = hardCap;
        _isActive = true;
        devAddress = dev;
        presaleInfo = info;
        unlockLiquidity = block.timestamp + unlock * 1 weeks;

        emit Started(
            saleRate,
            minInvestment,
            maxInvestment,
            maxInvestmentTotal,
            cap,
            _isActive,
            devAddress,
            presaleInfo,
            unlockLiquidity
        );
    }

    receive() external payable {
        require(_isActive == true && address(this).balance <= cap, "Presale is not active");
        require(msg.value != 0, "msg.value can not be 0");
        require(msg.value <= maxInvestment, "> maxInvestment");
        require(msg.value >= minInvestment, "< minInvestment");
        require(investors[_msgSender()] + msg.value <= maxInvestmentTotal, "Limit of maxInvestmentTotal");
        require(!address(_msgSender()).isContract() && _msgSender() == tx.origin);

        uint256 tokens = saleRate.mul(msg.value);
        investors[_msgSender()] = investors[_msgSender()].add(msg.value);
        emit Received(_msgSender(), msg.value, tokens, investors[_msgSender()]);
        token.transfer(_msgSender(), tokens);
    }

    function endPresale() public onlyOwner {
        require(_isActive == true, "Presale is not active");

        //80%-20% liquidity-dev
        devEth = address(this).balance.div(5);
        liquidityEth = address(this).balance.sub(devEth);

        //Set price 25% higher than presale
        poolRate = saleRate.sub(saleRate.div(4));
        liquidityTokens = poolRate.mul(liquidityEth);

        if (liquidityTokens > token.balanceOf(address(this))) {
            liquidityTokens = token.balanceOf(address(this));
            liquidityEth = liquidityTokens.mul(10**18).div(poolRate);
        }

        require(poolRate < saleRate && liquidityTokens.div(liquidityEth) == poolRate, "Invalid rate");

        _isActive = false;
        _isEnded = true;

        emit Ended(devEth, liquidityEth, liquidityTokens, saleRate, poolRate);
    }

    function addLiquidityToPool() public onlyOwner {
        require(_isEnded == true, "ERROR: Presale is not ended");
        require(_isPool == false, "ERROR: Liquidity already added in pool");

        token.approve(address(uniswapV2Router), liquidityTokens);

        uniswapV2Router.addLiquidityETH{value: liquidityEth}(
            address(token),
            liquidityTokens,
            0,
            0,
            address(this),
            block.timestamp + 20 minutes
        );

        _isPool = true;
    }

    function setFees(
        uint256 taxFee,
        uint256 charityFee,
        uint256 devFee,
        uint256 liquidityFee
    ) public onlyOwner {
        require(_isPool == true, "Liquidity not added in pool");
        require(taxFee >= 1 && taxFee <= 10, "taxFee should be in 1 - 10");
        require(charityFee >= 1 && charityFee <= 5, "charityFee should be in 1 - 5");
        require(devFee >= 1 && taxFee <= 10, "taxFee should be in 1 - 10");
        require(liquidityFee >= 1 && charityFee <= 5, "charityFee should be in 1 - 5");

        token.setRewardsFeePercent(taxFee);
        token.setCharityFeePercent(charityFee);
        token.setDevFeePercent(devFee);
        token.setLiquidityFeePercent(liquidityFee);
    }

    function withdrawDevEth() public onlyOwner {
        require(_isPool == true, "Liquidity not added in pool");
        require(address(this).balance > 0, "contract balance is 0");

        emit WithdrawDev(address(this).balance);
        devAddress.transfer(address(this).balance);
    }

    function withdrawLiquidity() public onlyOwner {
        require(unlockLiquidity < block.timestamp, "liquidity lock still active");
        require(uniswapV2Pair.balanceOf(address(this)) > 0, "uniswapV2Pair.balanceOf(address(this)) is 0");

        emit WithdrawLiquidity(address(uniswapV2Pair), uniswapV2Pair.balanceOf(address(this)));
        uniswapV2Pair.transfer(_msgSender(), uniswapV2Pair.balanceOf(address(this)));
    }

    function withdrawTokens() public onlyOwner {
        require(unlockLiquidity < block.timestamp, "liquidity lock still active");
        require(token.balanceOf(address(this)) > 0, "token.balanceOf(address(this)) is 0");

        emit WithdrawTokens(token.balanceOf(address(this)));
        token.transfer(_msgSender(), token.balanceOf(address(this)));
    }
}
