// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IERC20 {
    function transferFrom(address sender, address recipient, uint amount) external returns (bool);
    function transfer(address to, uint value) external returns (bool);
}

contract EscrowContract {
 
    address public usdtToken;
    address public owner; 
    address public arbitrator;            
    address public relayer;                
    address public withdrawalAddress;     
    address public withdrawer;    
    uint public platformFees;
   
    enum EscrowStatus { Pending, Released, Cancelled }


    struct Escrow {
        address seller;         
        address buyer;          
        uint amount;         
        uint fee;            
        EscrowStatus status;    
    }

    
    mapping(uint => Escrow) public escrows;
    
    uint public escrowCounter;

    uint public feeToBePayed = 200;

    
    event EscrowCreated(uint indexed escrowId, address indexed seller, address indexed buyer, uint amount, uint fee);
    
    event EscrowReleased(uint indexed escrowId, address indexed buyer, uint amount, uint fee);
    
    event EscrowCancelled(uint indexed escrowId, address indexed seller, uint amount);
    
    event EscrowRelayed(uint indexed escrowId, string instructions);
    event DisputeResolved(uint indexed escrowId, address recipient, uint amount);
    event ArbitratorSet(address arbitrator);
    event OwnerSet(address owner);
    event RelayerSet(address relayer);
    event WithdrawalAddressSet(address withdrawalAddress);
    event WithdrawerSet(address withdrawer);
    event FeesSwept(uint amount, address to);
    event FeesWithdrawn(uint amount, address to);
    
    
    modifier onlyOwner() {
        require(msg.sender == owner, "Not the owner");
        _;
    }
    
    modifier onlyArbitrator() {
        require(msg.sender == arbitrator, "Not the arbitrator");
        _;
    }

    modifier onlyRelayer() {
        require(msg.sender == relayer, "Not the relayer");
        _;
    }

    modifier onlyWithdrawer() {
        require(msg.sender == withdrawer, "Not the withdrawer");
        _;
    }



     constructor(address _usdtToken, address _platformWallet)  {
        usdtToken = _usdtToken;           
        withdrawalAddress = _platformWallet;
        owner = msg.sender;
    }
    
    function setOwner(address _owner) external onlyOwner {
        owner = _owner;
        emit OwnerSet(_owner);
    }    
    
     function setArbitrator(address _arbitrator) external onlyOwner {
        arbitrator = _arbitrator;
        emit ArbitratorSet(_arbitrator);
    }

    function setRelayer(address _relayer) external onlyOwner {
        relayer = _relayer;
        emit RelayerSet(_relayer);
    }
    
    
    function setWithdrawalAddress(address _withdrawalAddress) external onlyOwner {
        withdrawalAddress = _withdrawalAddress;
        emit WithdrawalAddressSet(_withdrawalAddress);
    }

   
    function setWithdrawer(address _withdrawer) external onlyOwner {
        withdrawer = _withdrawer;
        emit WithdrawerSet(_withdrawer);
    }

    
    function sweepFees() external onlyOwner {
        require(platformFees > 0, "No fees to sweep");
        uint amount = platformFees;
        platformFees = 0;
        require(IERC20(usdtToken).transfer(withdrawalAddress, amount), "Fee transfer failed");
        emit FeesSwept(amount, withdrawalAddress);
    }

   
    function withdrawFees(uint amount) external onlyWithdrawer {
        require(amount <= platformFees, "Insufficient fees");
        platformFees -= amount;
        require(IERC20(usdtToken).transfer(withdrawalAddress, amount), "Withdrawal failed");
        emit FeesWithdrawn(amount, withdrawalAddress);
    }
    
     function relay(uint escrowId, string memory instructions) external onlyRelayer {
        Escrow storage escrow = escrows[escrowId];
        require(escrow.status == EscrowStatus.Pending, "Escrow not in pending state");
        emit EscrowRelayed(escrowId, instructions);
    }

    
    function resolveDispute(uint escrowId, address recipient) external onlyArbitrator {
        Escrow storage escrow = escrows[escrowId];
        require(escrow.status == EscrowStatus.Pending, "Escrow not in pending state");
        escrow.status = EscrowStatus.Released;
        require(IERC20(usdtToken).transfer(recipient, escrow.amount), "Transfer failed");
        platformFees += escrow.fee;
        emit DisputeResolved(escrowId, recipient, escrow.amount);
    }

   
    function createEscrow(address buyer, uint amount) external {
        require(buyer != address(0), "Invalid buyer address");
        require(amount > 0, "Amount must be greater than zero");

       
        uint fee = (amount * feeToBePayed) / 10000;
   
        IERC20(usdtToken).transferFrom(msg.sender, address(this), amount);

        
        uint escrowId = escrowCounter++;
        
        
        escrows[escrowId] = Escrow({
            seller: msg.sender,
            buyer: buyer,
            amount: amount - fee, 
            fee: fee,
            status: EscrowStatus.Pending
        });
        emit EscrowCreated(escrowId, msg.sender, buyer, amount - fee, fee);
    }
    
    function releaseEscrow(uint escrowId) external {
        Escrow storage escrow = escrows[escrowId];
        require(escrow.status == EscrowStatus.Pending, "Escrow not in pending state");
        require(msg.sender == escrow.seller, "Only the seller can release the escrow");
         
        escrow.status = EscrowStatus.Released;
        require(IERC20(usdtToken).transfer((escrow.buyer), escrow.amount), "Transfer to buyer failed");
        platformFees += escrow.fee;
        
        emit EscrowReleased(escrowId, escrow.buyer, escrow.amount, escrow.fee);
    }
    
    function cancelEscrow(uint escrowId) external {
        Escrow storage escrow = escrows[escrowId];
        require(escrow.status == EscrowStatus.Pending, "Escrow not in pending state");
        require(msg.sender == escrow.seller, "Only the seller can cancel the escrow");
        escrow.status = EscrowStatus.Cancelled;
        require(IERC20(usdtToken).transfer(escrow.seller, escrow.amount + escrow.fee), "Refund to seller failed");
        emit EscrowCancelled(escrowId, escrow.seller, escrow.amount + escrow.fee);
    }
    
    
}
