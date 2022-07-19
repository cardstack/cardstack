
import pandas as pd
import duckdb
from collections import defaultdict
from cardpay_reward_programs.rules import staking


def create_rule(
    monkeypatch, test, table_names, fake_data_table1, fake_data_table2 = None,  core_config_overrides={}, user_config_overrides={}
):
   
    core_config = {
        "payment_cycle_length": 30,
        "start_block": 0,
        "end_block": 30,
        "subgraph_config_locations": {
            "prepaid_card_payment": "s3://cardpay-staging-partitioned-graph-data/data/prepaid_card_payments/0.0.3/",
            "spend_accumulation": "s3://tall-data-dev/paulin/spend_accumulation/0.0.1/",
            "safe_owner": "s3://tall-data-dev/paulin/safe_owner/0.0.1/"  
        }
    }

    core_config.update(core_config_overrides)
    user_config = {
        "token": "0x52031d287Bb58E26A379A7Fec2c84acB54f54fe3",
        "duration": 43200,
        "num_of_blocks_per_month": 30,
        "interest_rate_monthly": 0.5
    }

    user_config.update(user_config_overrides)
    con = duckdb.connect(database=":memory:", read_only=False)
    con.execute(f"""create table {table_names[0]} as select * from fake_data_table1""")

    if fake_data_table2 is not None:
        con.execute(f"""create table {table_names[1]} as select * from fake_data_table2""")

    

    def run_query(self, tables_names, vars):
        
        if test == "compound_parameters":
            vars = ["0x52031d287Bb58E26A379A7Fec2c84acB54f54fe3"] #[token, num_of_blocks_per_month, interest_rate_monthly]
        elif test == "partial_rewards":
            vars = ["0x52031d287Bb58E26A379A7Fec2c84acB54f54fe3", 30, 0.5 ]
        elif test == "base_rewards":
            vars = []
        elif test == "intermediate_rewards":
            vars = []
        elif test == "monthly_rewards":
            vars = []
        con.execute(self.sql_2(["TOKEN_TABLE", "SAFE_TABLE"]), vars)
        df = con.fetchdf()
        return df

    def sql_2(self, tables_names):
        
        if test == "compound_parameters":
            token_holder_table = "TOKEN_TABLE"
            safe_owner_table = "SAFE_TABLE"
            return f""" 
                select th.vid, th.lower_block_range, th.upper_block_range,so.owner, th.safe, th.balance,
                lag(th.balance) over (partition by th.safe order by th.upper_block_range asc NULLS LAST) as old_balance,
                th.balance - lag(th.balance) over (partition by th.safe order by th.upper_block_range asc NULLS LAST) as change,
                first_value(th.lower_block_range) over (partition by th.safe order by th.lower_block_range asc) as star_block,
                30 + first_value(th.lower_block_range) over (partition by th.safe order by th.lower_block_range asc) as end_block,
                (30 + first_value(th.lower_block_range) over (partition by th.safe order by th.lower_block_range asc)) - th.lower_block_range as blocks_to_finish,
                balance * 2 as rewards 
                from {token_holder_table} as th, {safe_owner_table} as so
                where th.token = $1::text
                and th.safe = so.safe
                and th.safe is not null;
            """
        ###-----BALANACE * AS REWARDS DELETE
        elif test == "partial_rewards":
            compound_parameters_table = "COMPOUND_PARAMETERS_TABLE"
            return f"""
                select *,(blocks_to_finish::float/30::float) as percentage_of_month, 
                (blocks_to_finish::float/$2::float)* $3 as interest_rate,
                ((blocks_to_finish::float/$2::float) * $3) * change as reward_in_tokens,
                change * 2 as rewards
                from {compound_parameters_table};
            """
        elif test == "base_rewards":
            partial_rewards_table = "PARTIAL_REWARDS_TABLE"
            return f"""select  distinct on (safe) safe, vid, owner, balance, blocks_to_finish, percentage_of_month, interest_rate,
            ((blocks_to_finish::float/30::float) * 0.5) * balance as reward_in_tokens,
            balance * 2 as rewards
            from {partial_rewards_table};"""
        elif test == "intermediate_rewards":
            partial_rewards_table = "AGG_PARTIAL_REWARDS_TABLE"
            return f""" 
            select safe, owner, sum(partial_reward) as intermediate_rewards,
            1000 as rewards
            from {partial_rewards_table} group by safe, owner order by safe;
            """
        elif test == "monthly_rewards":
            partial_rewards_table = "AGG_PARTIAL_REWARDS_TABLE_2"
            base_rewards_table = "BASE_REWARDS_TABLE"

            return f"""
                select br.vid, br.safe, br.owner, agr.intermediate_rewards, br.base_reward,
                br.base_reward + agr.intermediate_rewards as rewards,
                from {base_rewards_table} as br, {partial_rewards_table} as agr 
                where br.safe = agr.safe
            """
    

    ###-----BALANACE * AS REWARDS DELETE
    monkeypatch.setattr(staking.Staking, "run_query", run_query)
    monkeypatch.setattr(staking.Staking, "sql_2", sql_2)
    rule = staking.Staking(core_config, user_config)
    return rule

def get_amount(result, payee):
    return result.where(result["payee"] == payee)["amount"][0]

def test_compound_parameters(monkeypatch):
    fake_data_token_holder = pd.DataFrame(
        [
            {
                "vid":0,
                "lower_block_range": 0,
                "upper_block_range":10,
                "token": "0x52031d287Bb58E26A379A7Fec2c84acB54f54fe3",
                "safe": "safe1",
                "balance": 10000
            },
            {
                "vid":1,
                "lower_block_range": 10,
                "upper_block_range":15,
                "token": "0x52031d287Bb58E26A379A7Fec2c84acB54f54fe3",
                "safe": "safe1",
                "balance": 15000
            },
            {
                "vid":2,
                "lower_block_range": 15,
                "upper_block_range":20,
                "token": "0x52031d287Bb58E26A379A7Fec2c84acB54f54fe3",
                "safe": "safe1",
                "balance": 12000
            }
        ]
    )

    fake_data_safe_owner = pd.DataFrame(
        [
            {
                "owner": "owner1",
                "safe": "safe1"
            }
        ]
    )
    table_names = ["TOKEN_TABLE","SAFE_TABLE"]
    rule = create_rule(
        monkeypatch, "compound_parameters", table_names, fake_data_token_holder, fake_data_safe_owner, 
    )

    result = rule.run(200, "0x0")
    for i in range(len(result)):
        if i == 0: 
            prev_balance = result.where(result["vid"] == i)["balance"][i]
            continue

        old_balance = result.where(result["vid"] == i)["old_balance"][i]
        assert prev_balance == old_balance

        cur_balance =  result.where(result["vid"] == i)["balance"][i]
        change = result.where(result["vid"] == i)["change"][i]
        assert change == cur_balance - old_balance
        prev_balance = cur_balance

        blocks_to_finish = result.where(result["vid"] == i)["blocks_to_finish"][i]
        lower_block = result.where(result["vid"] == i)["lower_block_range"][i]
        end_block = result.where(result["vid"] == i)["end_block"][i]
        assert blocks_to_finish == end_block - lower_block
    
    
def test_partial_rewards(monkeypatch):
    fake_data_compound_parameter = pd.DataFrame(
        [
            {
                "vid":0,
                "lower_block_range":10,
                "upper_block_range":15,
                "owner":"owner1",
                "safe":"safe1",
                "balance":1500,
                "old_balance": 1000,
                "change": 500,
                "blocks_to_finish":15,
                "end_block": 30
            },
            {
                "vid":1,
                "lower_block_range":15,
                "upper_block_range":20,
                "owner":"owner1",
                "safe":"safe1",
                "balance":1200,
                "old_balance": 1500,
                "change": -300,
                "blocks_to_finish":10,
                "end_block": 30
            },
            {
                "vid":2,
                "lower_block_range":10,
                "upper_block_range":15,
                "owner":"owner2",
                "safe":"safe2",
                "balance":1500,
                "old_balance": 1000,
                "change": 500,
                "blocks_to_finish":15,
                "end_block": 30
            }
        ]
    )
    
    table_names = ["COMPOUND_PARAMETERS_TABLE"]
    rule = create_rule( monkeypatch, "partial_rewards", table_names, fake_data_compound_parameter)

    result = rule.run(200, "0x0")
    for i in range(len(result)):
        month_percentage = result.where(result["vid"] == i)["percentage_of_month"][i]
        blocks_to_finish = result.where(result["vid"] == i)["blocks_to_finish"][i]
        end_block = result.where(result["vid"] == i)["end_block"][i]
        interest_rate = result.where(result["vid"] == i)["interest_rate"][i]
        reward_in_tokens = result.where(result["vid"] == i)["reward_in_tokens"][i]
        change = result.where(result["vid"] == i)["change"][i]
        assert abs(month_percentage - float(blocks_to_finish/end_block)) < 0.01
        assert abs(interest_rate - (month_percentage * 0.5)) < 0.01
        assert abs(reward_in_tokens - (change * interest_rate)) < 0.01


def test_base_rewards(monkeypatch):
    

    fake_partial_rewards_data = pd.DataFrame([
        {
            "vid":0,
            "safe": "safe1",
            "owner": "owner1",
            "balance": 1000,
            "blocks_to_finish": 30,
            "percentage_of_month": 1,
            "interest_rate": 0.5
        },
        {
            "vid":0,
            "safe": "safe1",
            "owner": "owner1",
            "balance": 1500,
            "blocks_to_finish": 20,
            "percentage_of_month": 0.66,
            "interest_rate": 0.33
        },
        {
            "vid":1,
            "safe": "safe2",
            "owner": "owner2",
            "balance": 2000,
            "blocks_to_finish": 30,
            "percentage_of_month": 1,
            "interest_rate": 0.5
        }
        
    ])
    table_names = ["PARTIAL_REWARDS_TABLE"]
    rule = create_rule( monkeypatch, "base_rewards", table_names, fake_partial_rewards_data)
    result = rule.run(200, "0x0")
    assert len(result) == 2
    for i in range(len(result)):
         balance = result.where(result["vid"] == i)["balance"][i]
         interest_rate = result.where(result["vid"] == i)["interest_rate"][i]
         reward_in_tokens = result.where(result["vid"] == i)["reward_in_tokens"][i]
         assert reward_in_tokens - (balance * interest_rate) < 0.001
         
     
def test_intermediate_rewards(monkeypatch):
    

    fake_partial_rewards_data = pd.DataFrame(
    [
        {
            "id": 0,
            "vid": 0,
            "safe":"safe1",
            "owner":"owner1",
            "partial_reward": 1000
        },
        {
            "id": 1,
            "vid":0,
            "safe":"safe1",
            "owner":"owner1",
            "partial_reward": 500
        },
        {
            "id": 2,
            "vid":1,
            "safe":"safe2",
            "owner":"owner2",
            "partial_reward": 200
        },
        {
            "id": 3,
            "vid":1,
            "safe":"safe2",
            "owner":"owner2",
            "partial_reward": -300
        },
        {
            "id": 4,
            "vid":2,
            "safe":"safe3",
            "owner":"owner3",
            "partial_reward": 500
        }
        
    ])

    table_names = ["AGG_PARTIAL_REWARDS_TABLE"]
    rule = create_rule(monkeypatch, "intermediate_rewards", table_names, fake_partial_rewards_data)
    result = rule.run(200, "0x0")
    # assert len(result) == 3
    
    safe_sums = defaultdict(int)
    for i in range(len(fake_partial_rewards_data)):
        partial_reward = fake_partial_rewards_data.where(fake_partial_rewards_data["id"] == i)["partial_reward"][i]
        safe = fake_partial_rewards_data.where(fake_partial_rewards_data["id"] == i)["safe"][i]
        safe_sums[safe] += partial_reward
    
    
    for i in range(len(result)):
        owner_idx = "owner" + str(i + 1)
        inter_rewards = result.where(result["owner"] == owner_idx)["intermediate_rewards"][i]
        safe = result.where(result["owner"] == owner_idx)["safe"][i]
        if not inter_rewards:
            inter_rewards = 0
        assert safe_sums[safe] - inter_rewards < 0.0001


def test_total_monthly_rewards(monkeypatch):
    
    fake_data_partial_rewards = pd.DataFrame([
        {
            "safe": "safe1",
            "intermediate_rewards": 191.66
        },
        {
            "safe":"safe2",
            "intermediate_rewards": -91.666
        },
        {
            "safe": "safe3",
            "intermediate_rewards": 0
        }

    ])

    fake_data_base_rewards = pd.DataFrame([
        {
            "vid":0,
            "safe":"safe1",
            "owner": "owner1",
            "base_reward": 500
        },
        {
            "vid":1,
            "safe":"safe2",
            "owner": "owner2",
            "base_reward": 750
        },
        {
            "vid":2,
            "safe":"safe3",
            "owner": "owner3", 
            "base_reward": 7500
        }
    ])


    table_names = ["AGG_PARTIAL_REWARDS_TABLE_2", "BASE_REWARDS_TABLE"]

    rule = create_rule(monkeypatch, "monthly_rewards", table_names, fake_data_partial_rewards, fake_data_base_rewards)
    result = rule.run(200, "0x0")
    assert len(result) == 3 
    for i in range(len(result)):
        base_reward = result.where(result["vid"] == i)["base_reward"][i]
        intermediate_reward = result.where(result["vid"] == i)["intermediate_rewards"][i] 
        rewards = result.where(result["vid"] == i)["rewards"][i]  
        assert rewards - (base_reward + intermediate_reward) < 0.0001






