// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.12;

import "./contracts/Ownable.sol";
import "./libraries/SafeMath.sol";
import "./interfaces/IERC20.sol";

contract Locker is Ownable {
    using SafeMath for uint256;

    struct Deposit {
        address tokenAddress;
        address withdrawalAddress;
        uint256 tokenAmount;
        uint256 unlockTime;
        bool withdrawn;
    }

    uint256 private depositId;
    uint256[] private allDepositIds;

    mapping(uint256 => Deposit) private lockedToken;
    mapping(address => uint256[]) private depositsByWithdrawalAddress;
    mapping(address => uint256[]) private depositsByTokenAddress;
    mapping(address => mapping(address => uint256)) private walletTokenBalance;

    event TokensLocked(
        address indexed tokenAddress,
        address indexed sender,
        uint256 amount,
        uint256 unlockTime,
        uint256 depositId
    );
    event TokensWithdrawn(address indexed tokenAddress, address indexed receiver, uint256 amount);
    event EmergencyTokensWithdrawn(address indexed tokenAddress, address indexed receiver, uint256 amount);
    event WithdrawSpecificToken(address indexed token, address indexed receiver, uint256 amount);
    event Renewed(uint256 indexed id, uint256 unlockeTime);

    function lockTokens(
        address _tokenAddress,
        uint256 _amount,
        address _withdrawalAddress,
        uint256 _unlockTime
    ) external onlyOwner {
        _lockTokens(_tokenAddress, _amount, _withdrawalAddress, _unlockTime);
    }

    function lockTokenMultiple(
        address _tokenAddress,
        uint256[] calldata _amounts,
        address[] calldata _withdrawalAddresses,
        uint256[] calldata _unlockTimes
    ) external onlyOwner {
        for (uint8 i = 0; i < _amounts.length; i++) {
            _lockTokens(_tokenAddress, _amounts[i], _withdrawalAddresses[i], _unlockTimes[i]);
        }
    }

    function _lockTokens(
        address _tokenAddress,
        uint256 _amount,
        address _withdrawalAddress,
        uint256 _unlockTime
    ) internal returns (uint256 _id) {
        require(_amount > 0, "Tokens amount must be greater than 0");
        require(_unlockTime < 10000000000, "Unix timestamp must be in seconds, not milliseconds");
        require(_unlockTime > block.timestamp, "Unlock time must be in future");
        require(
            IERC20(_tokenAddress).transferFrom(msg.sender, address(this), _amount),
            "Failed to transfer tokens to locker"
        );

        uint256 lockAmount = _amount;

        walletTokenBalance[_tokenAddress][_withdrawalAddress] = walletTokenBalance[_tokenAddress][_withdrawalAddress]
            .add(_amount);

        _id = ++depositId;

        lockedToken[_id].tokenAddress = _tokenAddress;
        lockedToken[_id].withdrawalAddress = _withdrawalAddress;
        lockedToken[_id].tokenAmount = lockAmount;
        lockedToken[_id].unlockTime = _unlockTime;
        lockedToken[_id].withdrawn = false;

        allDepositIds.push(_id);

        depositsByWithdrawalAddress[_withdrawalAddress].push(_id);
        depositsByTokenAddress[_tokenAddress].push(_id);

        emit TokensLocked(_tokenAddress, _withdrawalAddress, _amount, _unlockTime, depositId);
    }

    function emergencyWithdrawTokens(uint256 _id, address _receiver) external onlyOwner {
        require(!lockedToken[_id].withdrawn, "Tokens already withdrawn");
        require(address(0) != _receiver, "Invalid receiver address");

        address tokenAddress = lockedToken[_id].tokenAddress;
        address withdrawalAddress = lockedToken[_id].withdrawalAddress;
        uint256 amount = lockedToken[_id].tokenAmount;

        require(IERC20(tokenAddress).transfer(_receiver, amount), "Failed to transfer tokens");

        lockedToken[_id].withdrawn = true;

        uint256 previousBalance = walletTokenBalance[tokenAddress][msg.sender];

        walletTokenBalance[tokenAddress][msg.sender] = previousBalance.sub(amount);

        uint256 i;
        uint256 j;
        uint256 byWLength = depositsByWithdrawalAddress[withdrawalAddress].length;
        uint256[] memory newDepositsByWithdrawal = new uint256[](byWLength - 1);

        for (j = 0; j < byWLength; j++) {
            if (depositsByWithdrawalAddress[withdrawalAddress][j] == _id) {
                for (i = j; i < byWLength - 1; i++) {
                    newDepositsByWithdrawal[i] = depositsByWithdrawalAddress[withdrawalAddress][i + 1];
                }
                break;
            } else {
                newDepositsByWithdrawal[j] = depositsByWithdrawalAddress[withdrawalAddress][j];
            }
        }

        depositsByWithdrawalAddress[withdrawalAddress] = newDepositsByWithdrawal;

        uint256 byTLength = depositsByTokenAddress[tokenAddress].length;
        uint256[] memory newDepositsByToken = new uint256[](byTLength - 1);

        for (j = 0; j < byTLength; j++) {
            if (depositsByTokenAddress[tokenAddress][j] == _id) {
                for (i = j; i < byTLength - 1; i++) {
                    newDepositsByToken[i] = depositsByTokenAddress[tokenAddress][i + 1];
                }
                break;
            } else {
                newDepositsByToken[j] = depositsByTokenAddress[tokenAddress][j];
            }
        }

        depositsByTokenAddress[tokenAddress] = newDepositsByToken;

        emit EmergencyTokensWithdrawn(tokenAddress, withdrawalAddress, amount);
    }

    function renewLock(uint256 _id, uint256 _unlockTime) external onlyOwner {
        require(block.timestamp >= lockedToken[_id].unlockTime, "Tokens are locked");
        require(!lockedToken[_id].withdrawn, "Tokens already withdrawn");
        require(msg.sender == lockedToken[_id].withdrawalAddress, "Can withdraw from the address used for locking");
        require(_unlockTime > block.timestamp, "Unlock time must be in future");

        lockedToken[_id].unlockTime = _unlockTime;

        emit Renewed(_id, _unlockTime);
    }

    function withdrawDeposit(uint256 _id) external {
        require(block.timestamp >= lockedToken[_id].unlockTime, "Tokens are locked");
        require(!lockedToken[_id].withdrawn, "Tokens already withdrawn");
        require(msg.sender == lockedToken[_id].withdrawalAddress, "Can withdraw from the address used for locking");

        address tokenAddress = lockedToken[_id].tokenAddress;
        address withdrawalAddress = lockedToken[_id].withdrawalAddress;
        uint256 amount = lockedToken[_id].tokenAmount;
        uint256 balance = IERC20(tokenAddress).balanceOf(address(this));

        if (balance < amount) {
            require(IERC20(tokenAddress).transfer(withdrawalAddress, balance), "Failed to transfer tokens");
        } else {
            require(IERC20(tokenAddress).transfer(withdrawalAddress, amount), "Failed to transfer tokens");
        }

        lockedToken[_id].withdrawn = true;

        uint256 previousBalance = walletTokenBalance[tokenAddress][msg.sender];

        walletTokenBalance[tokenAddress][msg.sender] = previousBalance.sub(amount);

        uint256 i;
        uint256 j;
        uint256 byWLength = depositsByWithdrawalAddress[withdrawalAddress].length;
        uint256[] memory newDepositsByWithdrawal = new uint256[](byWLength - 1);

        for (j = 0; j < byWLength; j++) {
            if (depositsByWithdrawalAddress[withdrawalAddress][j] == _id) {
                for (i = j; i < byWLength - 1; i++) {
                    newDepositsByWithdrawal[i] = depositsByWithdrawalAddress[withdrawalAddress][i + 1];
                }
                break;
            } else {
                newDepositsByWithdrawal[j] = depositsByWithdrawalAddress[withdrawalAddress][j];
            }
        }

        depositsByWithdrawalAddress[withdrawalAddress] = newDepositsByWithdrawal;

        uint256 byTLength = depositsByTokenAddress[tokenAddress].length;
        uint256[] memory newDepositsByToken = new uint256[](byTLength - 1);

        for (j = 0; j < byTLength; j++) {
            if (depositsByTokenAddress[tokenAddress][j] == _id) {
                for (i = j; i < byTLength - 1; i++) {
                    newDepositsByToken[i] = depositsByTokenAddress[tokenAddress][i + 1];
                }
                break;
            } else {
                newDepositsByToken[j] = depositsByTokenAddress[tokenAddress][j];
            }
        }

        depositsByTokenAddress[tokenAddress] = newDepositsByToken;

        emit TokensWithdrawn(tokenAddress, withdrawalAddress, amount);
    }

    function withdrawSpecificDeposit(
        address token,
        address receiver,
        uint256 amount
    ) external onlyOwner {
        require(address(0) != receiver, "Invalid receiver address");
        require(address(0) != token, "Invalid receiver address");
        require(amount >= 0, "Invaild amount");
        require(IERC20(token).transfer(receiver, amount));

        emit WithdrawSpecificToken(token, receiver, amount);
    }

    function getTotalTokenBalance(address _tokenAddress) public view returns (uint256) {
        return IERC20(_tokenAddress).balanceOf(address(this));
    }

    function getTokenBalanceByAddress(address _tokenAddress, address _walletAddress) public view returns (uint256) {
        return walletTokenBalance[_tokenAddress][_walletAddress];
    }

    function getAllDepositIds() public view returns (uint256[] memory) {
        return allDepositIds;
    }

    function getDepositDetails(uint256 _id)
        public
        view
        returns (
            address,
            address,
            uint256,
            uint256,
            bool
        )
    {
        return (
            lockedToken[_id].tokenAddress,
            lockedToken[_id].withdrawalAddress,
            lockedToken[_id].tokenAmount,
            lockedToken[_id].unlockTime,
            lockedToken[_id].withdrawn
        );
    }

    function getDepositsByWithdrawalAddress(address _withdrawalAddress) public view returns (uint256[] memory) {
        return depositsByWithdrawalAddress[_withdrawalAddress];
    }

    function getDepositsByTokenAddress(address _tokenAddress) public view returns (uint256[] memory) {
        return depositsByTokenAddress[_tokenAddress];
    }

    function getCurrentEpochtime() public view returns (uint256) {
        return block.timestamp;
    }
}
