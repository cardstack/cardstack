import pandas as pd
import duckdb

from cardpay_reward_programs.rules import dummy_rule

def create_rule(
    monkeypatch, fake_data_spend_acc, fake_data_safe_own, core_config_overrides={}, user_config_overrides={}
):
    
    core_config = {
        "payment_cycle_length": 32768,
        "start_block": 0,
        "end_block": 10000,
        "subgraph_config_locations": {
            "prepaid_card_payment": "s3://cardpay-staging-partitioned-graph-data/data/prepaid_card_payments/0.0.3/",
            "spend_accumulation": "s3://tall-data-dev/paulin/spend_accumulation/0.0.1/",
            "safe_owner": "s3://tall-data-dev/paulin/safe_owner/0.0.1/"  
        }
    }
    core_config.update(core_config_overrides)
    user_config = {
        "token": "0x52031d287Bb58E26A379A7Fec2c84acB54f54fe3",
        "base_reward": 5000000000000000000,
        "transaction_factor": 2,
        "spend_factor": 2,
        "duration": 43200
    }

    user_config.update(user_config_overrides)
    con = duckdb.connect(database=":memory:", read_only=False)

    con.execute("create table SPEND_TABLE as select * from fake_data_spend_acc")
    con.execute("create table SAFE_TABLE as select * from fake_data_safe_own")
    print(con.fetchdf()) # It is not creating the table_

    def table_query(
        self, config_name, table_name, min_partition: int, max_partition: int
    ):

        if table_name == "safe_owner":
            print("return safe")
            return "SAFE_TABLE"
        elif table_name == "spend_accumulation":
            print("return spend")
            return "SPEND_TABLE"
        else:
            print("Error creating tables")
            return ""

    def run_query(self, tables_names, vars):
        # con = duckdb.connect(database=":memory:", read_only=False) 
        con.execute(self.sql_2(["SPEND_TABLE", "SAFE_TABLE"]), vars)
        df = con.fetchdf()
        return df

    def sql_2(self, tables_names):

        spend_accumulation_table = "SPEND_TABLE"
        safe_owner_table = "SAFE_TABLE"

        return f""" 
            with merchant_safes as (
 	            select merchant_safe, _block_number
	            from {spend_accumulation_table}
	            where _block_number > $1::integer
	            and _block_number < $2::integer
	            and historic_spend_balance_uint64 > 100000
            ),
            final_safes as (
                select merchant_safe,
                max(_block_number)
                from merchant_safes
                group by 1      
            )
            select safe.owner as payee from {safe_owner_table} as safe, 
                final_safes as f_s
                where f_s.merchant_safe = safe.safe;
        """

    monkeypatch.setattr(dummy_rule.DummyRule, "_get_table_query", table_query)
    monkeypatch.setattr(dummy_rule.DummyRule, "run_query", run_query)
    monkeypatch.setattr(dummy_rule.DummyRule, "sql_2", sql_2)
    rule = dummy_rule.DummyRule(core_config, user_config)
    return rule

def get_amount(result, payee):
    return result.where(result["payee"] == payee)["amount"][0]

def test_identifies_correct_historic_balance(monkeypatch):
    fake_data_spend_acc = pd.DataFrame(
        [
            {
                "merchant_safe":"0x1",
                "_block_number":150, 
                "historic_spend_balance_uint64":100001 #Should Pass
            },
            {
                "merchant_safe":"0x2",
                "_block_number":160, 
                "historic_spend_balance_uint64":100000 #Filter out
            }
        ]
    )

    fake_data_safe_own = pd.DataFrame(
        [
            {"owner": "0xA", "safe": "0x1"},
            {"owner": "0xB", "safe": "0x2"}
        ]
    )

    rule = create_rule(
        monkeypatch, fake_data_spend_acc, fake_data_safe_own
    )


    result = rule.run(200, "0x0")
    
    assert len(result) == 1

def test_identifies_correct_block_number(monkeypatch):
    fake_data_spend_acc = pd.DataFrame(
        [
            {
                "merchant_safe":"0x1",
                "_block_number":150, 
                "historic_spend_balance_uint64":100001 
            },
            {
                "merchant_safe":"0x2",
                "_block_number":100001, #Larger than block range
                "historic_spend_balance_uint64":100001 
            }
        ]
    )

    fake_data_safe_own = pd.DataFrame(
        [
            {"owner": "0xA", "safe": "0x1"},
            {"owner": "0xB", "safe": "0x2"}
        ]
    )

    # print("fake: ", fake_data_safe_own)
    # print("fake: ", fake_data_spend_acc)
    rule = create_rule(
        monkeypatch, fake_data_spend_acc, fake_data_safe_own
    )


    result = rule.run(200, "0x0")
    
    assert len(result) == 1

def test_identifies_repetitive_safes(monkeypatch):
    fake_data_spend_acc = pd.DataFrame(
        [
            {
                "merchant_safe":"0x2",
                "_block_number":150, 
                "historic_spend_balance_uint64":100001 #Should Pass
            },
            {
                "merchant_safe":"0x2",
                "_block_number":151, 
                "historic_spend_balance_uint64":100001 #Filter out
            }
        ]
    )

    fake_data_safe_own = pd.DataFrame(
        [
            {"owner": "0xA", "safe": "0x1"},
            {"owner": "0xB", "safe": "0x2"}
        ]
    )

    # print("fake: ", fake_data_safe_own)
    # print("fake: ", fake_data_spend_acc)
    rule = create_rule(
        monkeypatch, fake_data_spend_acc, fake_data_safe_own
    )

    result = rule.run(200, "0x0")
    assert len(result) == 1


def test_identifies_no_matching_owners(monkeypatch):
    fake_data_spend_acc = pd.DataFrame(
        [
            {
                "merchant_safe":"0x2",
                "_block_number":150, 
                "historic_spend_balance_uint64":100001 #Should Pass
            },
            {
                "merchant_safe":"0x2",
                "_block_number":151, 
                "historic_spend_balance_uint64":100001 #Filter out
            }
        ]
    )

    fake_data_safe_own = pd.DataFrame(
        [
            {"owner": "0xA", "safe": "0x3"},
            {"owner": "0xB", "safe": "0x4"}
        ]
    )

    rule = create_rule(
        monkeypatch, fake_data_spend_acc, fake_data_safe_own
    )

    result = rule.run(200, "0x0")
    
    assert len(result) == 0





