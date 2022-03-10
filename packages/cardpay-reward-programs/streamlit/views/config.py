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

snapshot_block = 25165824
