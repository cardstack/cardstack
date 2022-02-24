default_config = {
    "subgraph_config_location": "s3://tall-data-dev/subgraph_extraction/staging_rewards/0.0.1/",
    "payment_cycle_length": 32768,
    "valid_from": 24000000,
    "valid_to": 26000000,
    "token": "0xcd7AB5c678Bc0b90dD6f870B8F214c10A943FC67",
}

required_core_parameters = ["subgraph_config_location", "valid_from", "valid_to"]
