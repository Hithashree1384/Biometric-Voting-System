// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract BiometricVoting {
    address public admin;

    mapping(uint => bool) public hasVoted;
    event VoteCast(uint voterId);

    constructor() {

        admin = msg.sender;

    }

    function vote(uint voterId) public {
        require(!hasVoted[voterId], "Voter has already voted");
        hasVoted[voterId] = true;
        emit VoteCast(voterId);
    }

    function checkVoted(uint voterId) public view returns (bool) {
        return hasVoted[voterId];
    }
}