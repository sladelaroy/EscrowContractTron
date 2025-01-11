const USDT = artifacts.require("MyUSDT");
const PlatformWallet = artifacts.require("PlatformWallet");
const EscrowContract = artifacts.require("EscrowContract");

module.exports = async function(deployer) {
  // Deploy USDT contract
  await deployer.deploy(USDT);
  const usdtInstance = await USDT.deployed();

  // Deploy PlatformWallet contract
  await deployer.deploy(PlatformWallet);
  const platformWalletInstance = await PlatformWallet.deployed();

  // Deploy EscrowContract with USDT and PlatformWallet addresses
  await deployer.deploy(EscrowContract, usdtInstance.address, platformWalletInstance.address);
};