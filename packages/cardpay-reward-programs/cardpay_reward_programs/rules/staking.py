from cardpay_reward_programs.rule import Rule
import pandas as pd


class Staking(Rule):
    """
    This rule rewards users with CARD.cpxd held in a depot in a monthly basis
    """

    def __init__(self, core_parameters, user_defined_parameters):
        super(Staking, self).__init__(core_parameters, user_defined_parameters)

    def set_user_defined_parameters(self, token, duration, interest_rate_monthly):
        self.token = token
        self.duration = duration
        self.interest_rate_monthly = interest_rate_monthly

    def sql(self, table_query, aux_table_query):
        token_holder_table = table_query
        safe_owner_table = aux_table_query

        return f"""
            with balance_changes as (select
                safe,
                balance_uint64 - lag(balance_uint64, 1 ,0) over (partition by safe order by _block_number asc) as change,
                $5::float+1 as interest_rate,
                ($2::integer - _block_number::integer) / $4::float  as compounding_rate,
                from {token_holder_table}
                where _block_number::integer < $2::integer
                and token = $3::text
                and safe is not null
                qualify
                _block_number::integer >= $1::integer
                ),
            original_balances as (select safe,
                last_value(balance_uint64) over (partition by safe order by _block_number asc) as change,
                $5::float+1 as interest_rate,
                1 as compounding_rate,
                from {token_holder_table}
                where _block_number::integer < $1::integer
                and token = $3::text
                and safe is not null
                ),
            safe_owners as (
                select owner as payee, safe from {safe_owner_table}
            ),

            all_data as (select * from original_balances union all select * from balance_changes)

            select owner as payee, sum(change * ((interest_rate**compounding_rate) - 1)) as rewards
            from all_data
            left join {safe_owner_table} using (safe)
            group by payee
        """

    def run(self, payment_cycle: int, reward_program_id: str):
        start_block, end_block = (
            payment_cycle - self.payment_cycle_length,
            payment_cycle,
        )
        vars = [
            start_block,  # $1 -> int
            end_block,  # $2 -> int
            self.token,  # $3 -> str
            self.payment_cycle_length,  # $4 -> int
            self.interest_rate_monthly,  # $5 -> float
        ]

        table_query = self._get_table_query(
            "token_holder", "token_holder", 0, self.end_block
        )

        aux_table_query = self._get_table_query(
            "safe_owner", "safe_owner", 0, self.end_block
        )

        if table_query == "parquet_scan([])" or aux_table_query == "parquet_scan([])":
            df = pd.DataFrame(columns=["payee", "rewards"])
        else:
            df = self.run_query(table_query, vars, aux_table_query)
        df["rewardProgramID"] = reward_program_id
        df["paymentCycle"] = payment_cycle
        df["validFrom"] = payment_cycle
        df["validTo"] = payment_cycle + self.duration
        df["token"] = self.token
        df["amount"] = df["rewards"]
        df.drop(["rewards"], axis=1)
        return df
