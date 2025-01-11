// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract PlatformWallet {
    address public owner;

    event Deposit(address indexed sender, uint amount);
    event Withdrawal(address indexed recipient, uint amount);

    modifier onlyOwner() {
        require(msg.sender == owner, "Not the contract owner");
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    receive() external payable {
        emit Deposit(msg.sender, msg.value);
    }

    function withdraw(uint amount) external onlyOwner {
        require(address(this).balance >= amount, "Insufficient balance");
        payable(owner).transfer(amount);
        emit Withdrawal(owner, amount);
    }

    function getBalance() external view returns (uint) {
        return address(this).balance;
    }
}