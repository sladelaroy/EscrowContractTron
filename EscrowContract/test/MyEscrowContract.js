const MyEscrowContract = artifacts.require("EscrowContract");
const USDT = artifacts.require("MyUSDT");
const PlatformWallet = artifacts.require("PlatformWallet");

contract("MyEscrowContract", (accounts) => {
  let usdtInstance;
  let platformWalletInstance;
  let escrowInstance;

  const owner = accounts[0];
  const arbitrator = accounts[1];
  const relayer = accounts[2];
  const withdrawer = accounts[3];
  const user1 = accounts[4];
  const user2 = accounts[5];

  before(async () => {
    usdtInstance = await USDT.new();
    platformWalletInstance = await PlatformWallet.new();
    escrowInstance = await MyEscrowContract.new(usdtInstance.address, platformWalletInstance.address);
  });

  it("should set the correct owner", async () => {
    const contractOwner = await escrowInstance.owner();
    assert.equal(contractOwner, owner, "Owner is not set correctly");
  });

  it("should set the correct USDT token address", async () => {
    const usdtAddress = await escrowInstance.usdtToken();
    assert.equal(usdtAddress, usdtInstance.address, "USDT token address is not set correctly");
  });

  it("should set the correct platform wallet address", async () => {
    const platformWalletAddress = await escrowInstance.withdrawalAddress();
    assert.equal(platformWalletAddress, platformWalletInstance.address, "Platform wallet address is not set correctly");
  });

  it("should allow only the owner to set the arbitrator", async () => {
    await escrowInstance.setArbitrator(arbitrator, { from: owner });
    const contractArbitrator = await escrowInstance.arbitrator();
    assert.equal(contractArbitrator, arbitrator, "Arbitrator is not set correctly");

    try {
      await escrowInstance.setArbitrator(arbitrator, { from: user1 });
      assert.fail("Non-owner was able to set the arbitrator");
    } catch (error) {
      assert(error.message.includes("Not the owner"), "Expected 'Not the owner' error");
    }
  });

  it("should allow only the owner to set the relayer", async () => {
    await escrowInstance.setRelayer(relayer, { from: owner });
    const contractRelayer = await escrowInstance.relayer();
    assert.equal(contractRelayer, relayer, "Relayer is not set correctly");

    try {
      await escrowInstance.setRelayer(relayer, { from: user1 });
      assert.fail("Non-owner was able to set the relayer");
    } catch (error) {
      assert(error.message.includes("Not the owner"), "Expected 'Not the owner' error");
    }
  });

  it("should allow only the owner to set the withdrawer", async () => {
    await escrowInstance.setWithdrawer(withdrawer, { from: owner });
    const contractWithdrawer = await escrowInstance.withdrawer();
    assert.equal(contractWithdrawer, withdrawer, "Withdrawer is not set correctly");

    try {
      await escrowInstance.setWithdrawer(withdrawer, { from: user1 });
      assert.fail("Non-owner was able to set the withdrawer");
    } catch (error) {
      assert(error.message.includes("Not the owner"), "Expected 'Not the owner' error");
    }
  });

  it("should create an escrow", async () => {
    
    const amount = 1000;
    await usdtInstance.transfer(user1, amount, { from: owner });
    await usdtInstance.approve(escrowInstance.address, amount, { from: user1 });
    await escrowInstance.createEscrow(user2, amount, { from: user1 });

    const escrow = await escrowInstance.escrows(0);
    assert.equal(escrow.sender, user1, "Escrow sender is not set correctly");
    assert.equal(escrow.recipient, user2, "Escrow recipient is not set correctly");
    assert.equal(escrow.amount.toNumber() + escrow.fee.toNumber(), amount, "Escrow amount is not set correctly");
    assert.equal(escrow.status.toNumber(), 0, "Escrow status is not set correctly");

    console.log(escrow)
  });

  it("should release an escrow", async () => {
    const amount = 1000;
    await usdtInstance.transfer(user1, amount, { from: owner });
    await usdtInstance.approve(escrowInstance.address, amount, { from: user1 });
    await escrowInstance.createEscrow(user2, amount, { from: user1 });

    await escrowInstance.releaseEscrow(1, { from: user1 });

    const escrow = await escrowInstance.escrows(1);
    assert.equal(escrow.status.toNumber(), 1, "Escrow status is not set to Released");

    const recipientBalance = await usdtInstance.balanceOf(user2);
    assert.equal(recipientBalance.toNumber() + escrow.fee.toNumber(), 1000, "Recipient did not receive the correct amount");
  });

  it("should cancel an escrow", async () => {
    const amount = 1000;

    // Transfer USDT to user1 and approve escrow contract to spend it
    await usdtInstance.transfer(user1, amount, { from: owner });
    await usdtInstance.approve(escrowInstance.address, amount, { from: user1 });

    // Create an escrow
    await escrowInstance.createEscrow(user2, amount, { from: user1 });

    // Cancel the escrow
    await escrowInstance.cancelEscrow(0, { from: user1 });

    // Check the escrow status
    const escrow = await escrowInstance.escrows(0);
    assert.equal(escrow.status.toNumber(), 2, "Escrow status is not set to Cancelled");

    // Check the sender's balance to ensure the amount is refunded
    const senderBalance = await usdtInstance.balanceOf(user1);
    assert.equal(senderBalance.toNumber(), amount, "Sender did not receive the correct amount back");
  });

  it("should allow only the owner to set the withdrawal address", async () => {
    const newWithdrawalAddress = accounts[6];
    await escrowInstance.setWithdrawalAddress(newWithdrawalAddress, { from: owner });
    const withdrawalAddress = await escrowInstance.withdrawalAddress();
    assert.equal(withdrawalAddress, newWithdrawalAddress, "Withdrawal address is not set correctly");

    try {
      await escrowInstance.setWithdrawalAddress(newWithdrawalAddress, { from: user1 });
      assert.fail("Non-owner was able to set the withdrawal address");
    } catch (error) {
      assert(error.message.includes("Not the owner"), "Expected 'Not the owner' error");
    }
  });

  it("deduct fees ", async () => {
    const initialBalance = await usdtInstance.balanceOf(platformWalletInstance.address);
    const amount = 1000;
    await usdtInstance.transfer(user1, amount, { from: owner });
    await usdtInstance.approve(escrowInstance.address, amount, { from: user1 });
    await escrowInstance.createEscrow(user2, amount, { from: user1 });

    const fee = (amount * 200)/10000;

    const platformFees = await escrowInstance.platformFees();

    assert.equal(fee, platformFees.toNumber(), "Fees are not set correctly");

  });

  it("should allow only the relayer to relay transactions", async () => {

    const amount = 1000;
    await usdtInstance.transfer(user1, amount, { from: owner });
    await usdtInstance.approve(escrowInstance.address, amount, { from: user1 });
    await escrowInstance.createEscrow(user2, amount, { from: user1 });
    const message = "testing testing";

    await escrowInstance.relay(9, message, { from: relayer });

    try {
      await escrowInstance.relay(9, message, { from: user1 });
      assert.fail("Non-relayer was able to relay transactions");
    } catch (error) {
      assert(error.message.includes("Not the relayer"), "Expected 'Not the relayer' error");
    }
  });

  it("should allow only the arbitrator to resolve disputes", async () => {
    const amount = 1000;

    const fee = (amount * 200)/10000;
    await usdtInstance.transfer(user1, amount, { from: owner });
    await usdtInstance.approve(escrowInstance.address, amount, { from: user1 });
    await escrowInstance.createEscrow(user2, amount, { from: user1 });

    await escrowInstance.resolveDispute(10, user2, { from: arbitrator });

    const escrow = await escrowInstance.escrows(10);
    assert.equal(escrow.status.toNumber(), 1, "Escrow status is not set to Released");

    const recipientBalance = await usdtInstance.balanceOf(user2);
    assert.equal(recipientBalance.toNumber(), amount - fee, "Recipient did not receive the correct amount");

    try {
      await escrowInstance.resolveDispute(10, user2, { from: user1 });
      assert.fail("Non-arbitrator was able to resolve disputes");
    } catch (error) {
      assert(error.message.includes("Not the arbitrator"), "Expected 'Not the arbitrator' error");
    }
  });

});