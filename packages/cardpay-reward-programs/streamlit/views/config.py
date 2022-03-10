cardpay_genesis_block = {
    "sokol": 21403252,
    "xdai": 17265698,
}
view_config_map = {
    "prod": {
        "start_block": cardpay_genesis_block["xdai"],
        "end_block": 20986720,
        "default_block": 20000000,
        "genesis_block": cardpay_genesis_block["xdai"],
    },
    "staging": {
        "start_block": 24117248,
        "end_block": 25117248,
        "default_block": 24150016,
        "genesis_block": cardpay_genesis_block["sokol"],
    },
}

token_sokol = {
    "dai": "0xFeDc0c803390bbdA5C4C296776f4b574eC4F30D1",
    "card": "0xB236ca8DbAB0644ffCD32518eBF4924ba866f7Ee",
}

token_xdai = {
    "dai": "0x26F2319Fbb44772e0ED58fB7c99cf8da59e2b5BE",
    "card": "0x52031d287Bb58E26A379A7Fec2c84acB54f54fe3",
}

main_config = {
    "xdai": {
        "reward_program_id": "0x4767D0D74356433d54880Fcd7f083751d64388aF",
        "token": token_sokol["card"],
    },
    "sokol": {
        "reward_program_id": "0x4767D0D74356433d54880Fcd7f083751d64388aF",
        "token": token_xdai["card"],
    },
}
