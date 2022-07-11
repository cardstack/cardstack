#!/usr/bin/env python3

merkle_roots = [
    {
        "id": "0x2ffd93ec2ddc15dcb170e3fb29a1f06df274e65746a715562f6a6579bd8e9cd7",
        "blockNumber": "26777352",
        "paymentCycle": "26777325",
        "rewardProgram": {"id": "0x5E4E148baae93424B969a0Ea67FF54c315248BbA"},
        "timestamp": "1653901895",
         "rootHash": "0x9f880d8e63c4dca5f33fce867a36e988afbf41ed9f1ab0e08387b1bc76921173",
    },
    {
        "id": "0x68c1355a6f7b96aaa03ae6085d37f23d04e753b07b8cf4d18e546c0d1565bb63",
        "blockNumber": "26777606",
        "paymentCycle": "26777601",
        "rewardProgram": {"id": "0x5E4E148baae93424B969a0Ea67FF54c315248BbA"},
        "timestamp": "1653905565",
        "rootHash": "0x3b4096bd5a350c9469089b781e7ee0c7e57a08749b267c770604a14e80f835b2"
    },
    {
        "id": "0x7acb8082f540d8e7a3dc283534f09bd50e9ad37eea940441a87b43db3266e026",
        "blockNumber": "26778059",
        "paymentCycle": "26778053",
        "rewardProgram": {"id": "0x5E4E148baae93424B969a0Ea67FF54c315248BbA"},
        "timestamp": "1653912015",
        "rootHash": "0xee9c501af460fa65d059d64f415969cfa954413158af14c9e6a6e2f4e97d7d45"
    },
]

extra_one_merkle_roots = [
    {
        "id": "0x5cb1bb27201e79b9dc6a95c86f7ebc6bac9fdd0974daf3c74829e0218dc64e0b",
        "blockNumber": "26779083",
        "paymentCycle": "26779078",
        "rewardProgram": {"id": "0x5E4E148baae93424B969a0Ea67FF54c315248BbA"},
        "timestamp": "1653927315",
        "rootHash": "0x7454609cd9e953122ea8c0dbeafb345d7b7bfb72121636341aa1e25387a9ae02",
    },
    {
        "id": "0x58c510692db536c594237b69c9f3826df7de51b2162cd85c5ce241be2a874a7b",
        "blockNumber": "26779109",
        "paymentCycle": "26779104",
        "rewardProgram": {"id": "0x5E4E148baae93424B969a0Ea67FF54c315248BbA"},
        "timestamp": "1653927740",
        "rootHash": "0xd02399618b7a2bed6290a506605f51659c0de1889f2f271ff66fdcab3e048531",
    },
]

extra_one_merkle_roots_without_s3 = [
    {
        "id": "0x8c7ce5f0740ab9003ed71008ba516421ff337590ca2805e4275897b4674ee598",
        "blockNumber": "27000001",
        "paymentCycle": "27000000",
        "rewardProgram": {"id": "0x5E4E148baae93424B969a0Ea67FF54c315248BbA"},
        "timestamp": "1663927740",
        "rootHash": "0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",
    },
]

extra_one_merkle_roots_old_file = [
    {
        "id": "0x8c7ce5f0740ab9003ed71008ba516421ff337590ca2805e4275897b4674ee598",
        "blockNumber": "27000001",
        "paymentCycle": "27000000",
        "rewardProgram": {"id": "0x5E4E148baae93424B969a0Ea67FF54c315248BbA"},
        "timestamp": "1663927740",
        "rootHash": "0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",
    },
]

other_merkle_roots = [
    {
        "id": "0x31157fc28d6a747ebf9a9bbebb54052295bf1e18e79bea6337de2beaf688ad8d",
        "blockNumber": "26729082",
        "paymentCycle": "26722587",
        "rewardProgram": {"id": "0x2F57D4cf81c87A92dd5f0686fEc6e02887662d07"},
        "timestamp": "1653387365",
        "rootHash": "0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",
    }
]

reward_programs = [
    {"id": "0x0A4c62c8616342Fc3C5390c4e55aD26DeE694b0F"},
    {"id": "0x2F57D4cf81c87A92dd5f0686fEc6e02887662d07"},
    {"id": "0x5E4E148baae93424B969a0Ea67FF54c315248BbA"},
    {"id": "0x64D65d17B26312c0a2532E3cfB0a681A92eEf89d"},
    {"id": "0x73F92405b438D85ee46539a8FaDbBCa04C155F81"},
    {"id": "0x954A9C27bC398B4A8f6F543b13eea833d0e73308"},
    {"id": "0xd40c4b61D0B08548Dd1E2b79c1E8Ad98f15c65d8"},
]


def roots_for_program(reward_program_id, payment_cycle):
    """
    models get_merkle_roots
    """
    if reward_program_id == "0x5E4E148baae93424B969a0Ea67FF54c315248BbA":
        return merkle_roots
    if reward_program_id == "0x2F57D4cf81c87A92dd5f0686fEc6e02887662d07":
        return other_merkle_roots
    else:
        return []


def extra_one_merkle_roots_for_program(reward_program_id, payment_cycle):
    """
    models get_merkle_roots
    """
    if reward_program_id == "0x5E4E148baae93424B969a0Ea67FF54c315248BbA":
        return extra_one_merkle_roots
    if reward_program_id == "0x2F57D4cf81c87A92dd5f0686fEc6e02887662d07":
        return []
    else:
        return []


def extra_one_merkle_roots_without_s3(reward_program_id, payment_cycle):
    """
    models get_merkle_roots
    """
    if reward_program_id == "0x5E4E148baae93424B969a0Ea67FF54c315248BbA":
        return extra_one_merkle_roots_old_file
    if reward_program_id == "0x2F57D4cf81c87A92dd5f0686fEc6e02887662d07":
        return []
    else:
        return []


def extra_one_merkle_roots_old_file_written(reward_program_id, payment_cycle):
    """
    models get_merkle_roots
    """
    if reward_program_id == "0x5E4E148baae93424B969a0Ea67FF54c315248BbA":
        return extra_one_merkle_roots_old_file
    if reward_program_id == "0x2F57D4cf81c87A92dd5f0686fEc6e02887662d07":
        return []
    else:
        return []
