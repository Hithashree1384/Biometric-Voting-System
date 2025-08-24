const BiometricVoting = artifacts.require("BiometricVoting");

module.exports = function (deployer) {
  deployer.deploy(BiometricVoting);
};


//truffle console
// let instance = await BiometricVoting.deployed()
// await instance.vote(101)           // Cast a vote
// await instance.checkVoted(101)     // Returns true
